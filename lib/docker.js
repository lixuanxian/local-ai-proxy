const { spawn, execSync } = require("child_process");

/**
 * Docker sandbox manager.
 * Supports both one-off container runs and persistent sandbox containers.
 */

// Track running sandbox containers in-memory
const sandboxContainers = new Map(); // id -> { name, image, status, createdAt, containerId }

/**
 * Check if Docker is available and running
 */
function isDockerAvailable() {
  try {
    execSync("docker info", { stdio: "pipe", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * List running containers
 */
function listContainers() {
  try {
    const output = execSync(
      'docker ps --format "{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}"',
      { stdio: "pipe", timeout: 5000 }
    ).toString().trim();

    if (!output) return [];

    return output.split("\n").map((line) => {
      const [id, image, status, name] = line.split("|");
      return { id, image, status, name };
    });
  } catch {
    return [];
  }
}

/**
 * List all containers (including stopped) filtered by label
 */
function listSandboxContainers() {
  try {
    const output = execSync(
      'docker ps -a --filter "label=local-ai-proxy.sandbox=true" --format "{{.ID}}|{{.Image}}|{{.Status}}|{{.Names}}|{{.State}}"',
      { stdio: "pipe", timeout: 5000 }
    ).toString().trim();

    if (!output) return [];

    return output.split("\n").map((line) => {
      const [id, image, status, name, state] = line.split("|");
      return { id, image, status, name, state };
    });
  } catch {
    return [];
  }
}

/**
 * Run a command inside a Docker container (one-off)
 */
function runInContainer(config, command) {
  return new Promise((resolve, reject) => {
    const args = [
      "run", "--rm",
      "--cpus", config.cpu_limit || "1",
      "--memory", config.memory_limit || "512m",
      "--network", config.network || "none",
      config.image,
      "sh", "-c", command,
    ];

    const proc = spawn("docker", args, {
      shell: true,
      timeout: (config.timeout_seconds || 300) * 1000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk));
    proc.stderr.on("data", (chunk) => (stderr += chunk));

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on("error", (err) => {
      reject(new Error(`Docker execution failed: ${err.message}`));
    });
  });
}

/**
 * Create and start a persistent sandbox container
 * @param {object} config - Docker sandbox config
 * @returns {Promise<{containerId: string, name: string}>}
 */
function createSandbox(config) {
  return new Promise((resolve, reject) => {
    const name = `ai-sandbox-${config.id || Date.now()}`;
    const args = [
      "run", "-d",
      "--name", name,
      "--label", "local-ai-proxy.sandbox=true",
      "--label", `local-ai-proxy.config-id=${config.id || "default"}`,
      "--cpus", config.cpu_limit || "1",
      "--memory", config.memory_limit || "512m",
      "--network", config.network || "none",
    ];

    // Mount workspace if specified
    if (config.workspace_path) {
      args.push("-v", `${config.workspace_path}:/workspace`);
    }

    // Environment variables
    if (config.env_vars) {
      try {
        const envs = typeof config.env_vars === "string" ? JSON.parse(config.env_vars) : config.env_vars;
        for (const [k, v] of Object.entries(envs)) {
          args.push("-e", `${k}=${v}`);
        }
      } catch { /* ignore parse errors */ }
    }

    // Image and keep-alive command
    args.push(config.image, "sh", "-c", "tail -f /dev/null");

    const proc = spawn("docker", args, { shell: true });
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk));
    proc.stderr.on("data", (chunk) => (stderr += chunk));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Failed to create sandbox: ${stderr}`));
      }
      const containerId = stdout.trim().slice(0, 12);
      sandboxContainers.set(config.id, {
        name,
        image: config.image,
        containerId,
        status: "running",
        createdAt: new Date().toISOString(),
      });
      resolve({ containerId, name });
    });

    proc.on("error", (err) => reject(err));
  });
}

/**
 * Execute a command inside a running sandbox container
 * @param {string} containerName - Container name or ID
 * @param {string} command - Command to execute
 * @param {object} options - { timeout, workdir }
 * @returns {Promise<{stdout, stderr, exitCode}>}
 */
function execInSandbox(containerName, command, options = {}) {
  return new Promise((resolve, reject) => {
    const args = ["exec"];
    if (options.workdir) {
      args.push("-w", options.workdir);
    }
    args.push(containerName, "sh", "-c", command);

    const proc = spawn("docker", args, {
      shell: true,
      timeout: (options.timeout || 300) * 1000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk));
    proc.stderr.on("data", (chunk) => (stderr += chunk));

    proc.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on("error", (err) => {
      reject(new Error(`Docker exec failed: ${err.message}`));
    });
  });
}

/**
 * Stop a sandbox container
 */
function stopSandbox(containerName) {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["stop", containerName], { shell: true });
    let output = "";
    proc.stdout.on("data", (chunk) => (output += chunk));
    proc.stderr.on("data", (chunk) => (output += chunk));
    proc.on("close", (code) => {
      // Also remove from tracking
      for (const [key, val] of sandboxContainers) {
        if (val.name === containerName || val.containerId === containerName) {
          sandboxContainers.delete(key);
        }
      }
      resolve({ ok: code === 0, output: output.trim() });
    });
    proc.on("error", (err) => reject(err));
  });
}

/**
 * Remove a sandbox container (stop + rm)
 */
function removeSandbox(containerName) {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["rm", "-f", containerName], { shell: true });
    let output = "";
    proc.stdout.on("data", (chunk) => (output += chunk));
    proc.stderr.on("data", (chunk) => (output += chunk));
    proc.on("close", (code) => {
      for (const [key, val] of sandboxContainers) {
        if (val.name === containerName || val.containerId === containerName) {
          sandboxContainers.delete(key);
        }
      }
      resolve({ ok: code === 0, output: output.trim() });
    });
    proc.on("error", (err) => reject(err));
  });
}

/**
 * Get logs from a sandbox container
 */
function getSandboxLogs(containerName, tail = 100) {
  try {
    const output = execSync(`docker logs --tail ${tail} ${containerName}`, {
      stdio: "pipe",
      timeout: 5000,
    }).toString();
    return output;
  } catch (err) {
    return err.stderr ? err.stderr.toString() : "Failed to get logs";
  }
}

/**
 * Check if a sandbox container is running
 */
function isSandboxRunning(containerName) {
  try {
    const state = execSync(
      `docker inspect -f "{{.State.Running}}" ${containerName}`,
      { stdio: "pipe", timeout: 5000 }
    ).toString().trim();
    return state === "true";
  } catch {
    return false;
  }
}

/**
 * Pull a Docker image
 */
function pullImage(image) {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["pull", image], { shell: true });
    let output = "";

    proc.stdout.on("data", (chunk) => (output += chunk));
    proc.stderr.on("data", (chunk) => (output += chunk));

    proc.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`Failed to pull ${image}: ${output}`));
    });

    proc.on("error", (err) => reject(err));
  });
}

/**
 * Get Docker system info
 */
function getDockerInfo() {
  try {
    const version = execSync("docker version --format '{{.Server.Version}}'", {
      stdio: "pipe", timeout: 5000,
    }).toString().trim();

    return { connected: true, version };
  } catch {
    return { connected: false, version: null };
  }
}

/**
 * Get sandbox status for a config
 */
function getSandboxStatus(configId) {
  const tracked = sandboxContainers.get(configId);
  if (!tracked) return { running: false };

  const running = isSandboxRunning(tracked.name);
  if (!running) {
    sandboxContainers.delete(configId);
    return { running: false };
  }

  return {
    running: true,
    containerId: tracked.containerId,
    name: tracked.name,
    image: tracked.image,
    createdAt: tracked.createdAt,
  };
}

module.exports = {
  isDockerAvailable,
  listContainers,
  listSandboxContainers,
  runInContainer,
  createSandbox,
  execInSandbox,
  stopSandbox,
  removeSandbox,
  getSandboxLogs,
  isSandboxRunning,
  pullImage,
  getDockerInfo,
  getSandboxStatus,
  sandboxContainers,
};
