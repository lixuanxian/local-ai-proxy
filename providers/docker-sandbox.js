const { spawn } = require("child_process");
const { EventEmitter } = require("events");
const { formatMessages, makeResponse } = require("../lib/utils");
const docker = require("../lib/docker");

/**
 * Docker Sandbox Provider
 * Wraps AI CLI execution inside a Docker container for isolation.
 * Supports two modes:
 *   1. One-off: Runs the CLI command in a fresh container each time
 *   2. Persistent sandbox: Exec into a running sandbox container
 */
class DockerSandboxProvider {
  constructor({ name, sandboxConfig, innerCommand, innerBuildArgs }) {
    this.name = name || "docker-sandbox";
    this.sandboxConfig = sandboxConfig;
    this.innerCommand = innerCommand || "claude";
    this._innerBuildArgs = innerBuildArgs || ((prompt) => ["-p", prompt]);
  }

  /**
   * Build the full command string to run inside the container
   */
  _buildInnerCommand(prompt, model) {
    const args = this._innerBuildArgs(prompt, model);
    // Escape single quotes in args for shell
    const escapedArgs = args.map((a) => `'${a.replace(/'/g, "'\\''")}'`);
    return `${this.innerCommand} ${escapedArgs.join(" ")}`;
  }

  async chat(messages, options = {}) {
    const prompt = formatMessages(messages);
    const model = options.model || undefined;
    const innerCmd = this._buildInnerCommand(prompt, model);
    const cfg = this.sandboxConfig;

    // Check if there's a persistent sandbox running for this config
    const sandboxStatus = cfg.id ? docker.getSandboxStatus(cfg.id) : { running: false };

    if (sandboxStatus.running) {
      // Use exec in persistent sandbox
      const result = await docker.execInSandbox(
        sandboxStatus.name,
        innerCmd,
        { timeout: cfg.timeout_seconds || 300 }
      );
      if (result.exitCode !== 0) {
        throw new Error(`Sandbox command exited with code ${result.exitCode}: ${result.stderr}`);
      }
      return makeResponse(this.name, result.stdout.trim());
    }

    // One-off container run
    const result = await docker.runInContainer(cfg, innerCmd);
    if (result.exitCode !== 0) {
      throw new Error(`Docker sandbox exited with code ${result.exitCode}: ${result.stderr}`);
    }
    return makeResponse(this.name, result.stdout.trim());
  }

  chatStream(messages, options = {}) {
    const prompt = formatMessages(messages);
    const model = options.model || undefined;
    const innerCmd = this._buildInnerCommand(prompt, model);
    const cfg = this.sandboxConfig;
    const emitter = new EventEmitter();

    const sandboxStatus = cfg.id ? docker.getSandboxStatus(cfg.id) : { running: false };

    let proc;
    if (sandboxStatus.running) {
      // Exec in persistent sandbox
      const args = ["exec", sandboxStatus.name, "sh", "-c", innerCmd];
      proc = spawn("docker", args, { shell: true });
    } else {
      // One-off run
      const args = [
        "run", "--rm",
        "--cpus", cfg.cpu_limit || "1",
        "--memory", cfg.memory_limit || "512m",
        "--network", cfg.network || "none",
        cfg.image,
        "sh", "-c", innerCmd,
      ];
      proc = spawn("docker", args, { shell: true });
    }

    proc.stdout.on("data", (chunk) => {
      emitter.emit("data", chunk.toString());
    });

    proc.stderr.on("data", (chunk) => {
      // Log stderr but don't fail streaming
      console.error(`[docker-sandbox] stderr: ${chunk}`);
    });

    proc.on("close", () => emitter.emit("end"));
    proc.on("error", (err) => emitter.emit("error", err));

    return emitter;
  }
}

module.exports = DockerSandboxProvider;
