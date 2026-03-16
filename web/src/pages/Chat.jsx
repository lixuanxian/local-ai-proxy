import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Button, Select, Tooltip, Popconfirm, message, Spin, Drawer, Slider, InputNumber, AutoComplete, Switch, Tabs, Image } from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PaperClipOutlined,
  SearchOutlined,
  MessageOutlined,
  RobotOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FileExcelOutlined,
  FileWordOutlined,
  FileUnknownOutlined,
  EyeOutlined,
  BulbOutlined,
  FormOutlined,
  SettingOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  CloudDownloadOutlined,
  LinkOutlined,
  DownloadOutlined,
  CompressOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';
import { buildModelOptions } from '../provider-config.jsx';

const { TextArea } = Input;

const PRESET_ROLES = [
  { label: 'None', value: '', description: 'No system prompt' },
  { label: 'Code Assistant', value: 'You are an expert software engineer. Write clean, efficient, well-documented code. Follow best practices and explain your reasoning when needed.', description: 'Expert coder' },
  { label: 'Writing Editor', value: 'You are a professional writing editor. Help improve clarity, grammar, tone, and structure. Provide suggestions and rewrites when appropriate.', description: 'Text polish' },
  { label: 'Translator', value: 'You are a professional translator. Translate text accurately while preserving meaning, tone, and cultural nuances. If no target language is specified, translate to English.', description: 'Multi-language' },
  { label: 'Data Analyst', value: 'You are a data analysis expert. Help interpret data, suggest visualizations, write SQL/Python for data processing, and explain statistical concepts clearly.', description: 'Data & stats' },
  { label: 'Teacher', value: 'You are a patient and thorough teacher. Explain concepts step by step, use analogies, provide examples, and check for understanding. Adapt your explanation level to the student.', description: 'Clear explanations' },
  { label: 'Creative Writer', value: 'You are a creative writing assistant. Help with storytelling, world-building, character development, dialogue, and creative expression. Be imaginative and inspiring.', description: 'Stories & creativity' },
];

const SKILL_STORE = [
  { category: 'Code', items: [
    { name: 'Code Review', description: 'Analyze code quality, find bugs, suggest improvements', prompt_template: 'Please review the following code. Identify bugs, potential issues, security concerns, and suggest improvements:\n\n' },
    { name: 'Write Tests', description: 'Generate comprehensive unit tests', prompt_template: 'Please write comprehensive unit tests for the following code. Cover edge cases and important scenarios:\n\n' },
    { name: 'Refactor', description: 'Improve code structure and readability', prompt_template: 'Please refactor the following code to improve readability, performance, and maintainability. Explain your changes:\n\n' },
    { name: 'Debug', description: 'Help identify and fix bugs', prompt_template: 'Please help debug the following code. Identify the issue, explain why it occurs, and provide a fix:\n\n' },
    { name: 'Document', description: 'Generate code documentation and comments', prompt_template: 'Please generate clear documentation for the following code. Include function descriptions, parameter explanations, and usage examples:\n\n' },
    { name: 'Convert Language', description: 'Convert code between programming languages', prompt_template: 'Please convert the following code to the target language. Maintain the same logic and use idiomatic patterns in the target language:\n\n' },
  ]},
  { category: 'Writing', items: [
    { name: 'Summarize', description: 'Condense long text into key points', prompt_template: 'Please provide a concise summary of the following text, highlighting the key points:\n\n' },
    { name: 'Translate', description: 'Translate text between languages', prompt_template: 'Please translate the following text. If no target language is specified, translate to English. Preserve the original tone and meaning:\n\n' },
    { name: 'Proofread', description: 'Fix grammar, spelling, and style', prompt_template: 'Please proofread the following text. Fix grammar, spelling, punctuation, and improve clarity while preserving the original voice:\n\n' },
    { name: 'Rewrite', description: 'Rewrite text in a different tone or style', prompt_template: 'Please rewrite the following text to improve clarity and flow. If a target style/tone is specified, adapt accordingly:\n\n' },
    { name: 'Expand', description: 'Elaborate on brief notes or outlines', prompt_template: 'Please expand on the following notes/outline into well-structured, detailed content:\n\n' },
  ]},
  { category: 'Analysis', items: [
    { name: 'Explain Concept', description: 'Break down complex topics simply', prompt_template: 'Please explain the following concept in simple terms. Use analogies and examples to make it easy to understand:\n\n' },
    { name: 'Compare', description: 'Compare and contrast options', prompt_template: 'Please compare and contrast the following items. List pros, cons, key differences, and provide a recommendation:\n\n' },
    { name: 'Extract Data', description: 'Extract structured data from text', prompt_template: 'Please extract the key data points from the following text and organize them in a structured format (table or list):\n\n' },
    { name: 'SQL Query', description: 'Generate SQL from natural language', prompt_template: 'Please write an SQL query based on the following requirements. Include comments explaining the query logic:\n\n' },
  ]},
  { category: 'Productivity', items: [
    { name: 'Email Draft', description: 'Draft professional emails', prompt_template: 'Please draft a professional email based on the following context. Keep it concise and appropriate in tone:\n\n' },
    { name: 'Meeting Notes', description: 'Structure meeting notes with action items', prompt_template: 'Please organize the following meeting notes into a clear structure with: summary, key decisions, action items (with owners), and follow-ups:\n\n' },
    { name: 'TODO List', description: 'Break tasks into actionable steps', prompt_template: 'Please break down the following goal/task into a prioritized, actionable TODO list with estimated effort for each item:\n\n' },
  ]},
];

export default function Chat() {
  const { conversationId: urlConvId } = useParams();
  const navigate = useNavigate();

  // State
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(urlConvId || null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [providers, setProviders] = useState([]);
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [editingTitle, setEditingTitle] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState('');
  const [convListLoading, setConvListLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatMode, setChatMode] = useState('chat'); // 'chat', 'plan' or 'edit'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(null);
  const [maxTokens, setMaxTokens] = useState(null);
  const [skillsManagerOpen, setSkillsManagerOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillPrompt, setNewSkillPrompt] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contextInfo, setContextInfo] = useState(null);
  const [compressing, setCompressing] = useState(false);
  const [contextLimit, setContextLimit] = useState(10);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversations, providers, skills
  useEffect(() => {
    loadConversations();
    api.getProviders().then(data => {
      setProviders(data);
      // Set default provider and model if none selected
      const defaultProv = data.find(p => p.is_default && p.enabled) || data.find(p => p.enabled);
      if (defaultProv && !selectedProvider) {
        setSelectedProvider(defaultProv.id);
        if (defaultProv.default_model) setSelectedModel(defaultProv.default_model);
      }
    }).catch(() => {});
    api.getSkills().then(setSkills).catch(() => {});
  }, []);

  const loadConversations = async (search) => {
    setConvListLoading(true);
    try {
      const data = await api.getConversations(search);
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setConvListLoading(false);
    }
  };

  // Sync URL → state when navigating directly to /chat/:conversationId
  useEffect(() => {
    if (urlConvId && urlConvId !== activeConvId) {
      setActiveConvId(urlConvId);
    } else if (!urlConvId && activeConvId) {
      setActiveConvId(null);
    }
  }, [urlConvId]);

  // Sync state → URL when selecting a conversation
  useEffect(() => {
    const currentPath = activeConvId ? `/chat/${activeConvId}` : '/chat';
    if (window.location.pathname !== currentPath) {
      navigate(currentPath, { replace: true });
    }
  }, [activeConvId, navigate]);

  // Load conversation messages when active changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      setActiveConv(null);
      return;
    }
    loadConversation(activeConvId);
  }, [activeConvId]);

  const MSG_PAGE_SIZE = 10;

  const loadConversation = async (id) => {
    try {
      const data = await api.getConversation(id, { limit: MSG_PAGE_SIZE });
      setActiveConv(data);
      setMessages(data.messages || []);
      setHasMoreMessages((data.messages || []).length < (data.total_messages || 0));
      if (data.provider_id) setSelectedProvider(data.provider_id);
      if (data.model) setSelectedModel(data.model);
      setSystemPrompt(data.system_prompt || '');
      setTemperature(data.temperature ?? null);
      setMaxTokens(data.max_tokens ?? null);
      setContextLimit(data.context_limit ?? 10);
      // auto_compress is now a global setting in Settings page
      if (data.contextInfo) setContextInfo(data.contextInfo);
    } catch {
      message.error('Failed to load conversation');
    }
  };

  // Auto-scroll to bottom (skip when loading older messages)
  const skipAutoScroll = useRef(false);

  const loadOlderMessages = useCallback(async () => {
    if (!activeConvId || loadingMore || !hasMoreMessages || messages.length === 0) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const data = await api.getConversation(activeConvId, { limit: MSG_PAGE_SIZE, before: oldest.created_at });
      const older = (data.messages || []).filter(m => !messages.some(em => em.id === m.id));
      if (older.length === 0) {
        setHasMoreMessages(false);
      } else {
        // Preserve scroll position
        const container = messagesContainerRef.current;
        const prevHeight = container?.scrollHeight || 0;
        skipAutoScroll.current = true;
        setMessages(prev => [...older, ...prev]);
        setHasMoreMessages(older.length >= MSG_PAGE_SIZE);
        // After DOM update, restore scroll position
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevHeight;
          }
        });
      }
    } catch {
      message.error('Failed to load older messages');
    } finally {
      setLoadingMore(false);
    }
  }, [activeConvId, loadingMore, hasMoreMessages, messages]);

  useEffect(() => {
    if (skipAutoScroll.current) {
      skipAutoScroll.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Scroll-to-top detection for loading older messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      if (container.scrollTop < 50 && hasMoreMessages && !loadingMore) {
        loadOlderMessages();
      }
    };
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasMoreMessages, loadingMore, loadOlderMessages]);

  // Create new conversation
  const handleNewConversation = async () => {
    try {
      const conv = await api.createConversation({
        provider_id: selectedProvider,
        model: selectedModel,
      });
      setConversations(prev => [conv, ...prev]);
      setActiveConvId(conv.id);
      setAttachments([]);
      setSelectedSkills([]);
      inputRef.current?.focus();
    } catch {
      message.error('Failed to create conversation');
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id) => {
    await api.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
    }
  };

  // Rename conversation
  const handleRenameConversation = async (id) => {
    if (!editTitleValue.trim()) return;
    await api.updateConversation(id, { title: editTitleValue.trim() });
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editTitleValue.trim() } : c));
    if (activeConv?.id === id) {
      setActiveConv(prev => ({ ...prev, title: editTitleValue.trim() }));
    }
    setEditingTitle(null);
  };

  // Compress conversation memory
  const handleCompress = async () => {
    if (!activeConvId || compressing) return;
    setCompressing(true);
    try {
      const result = await api.compressConversation(activeConvId);
      if (result.contextInfo) setContextInfo(result.contextInfo);
      message.success('Conversation memory compressed');
      loadConversation(activeConvId);
    } catch (err) {
      message.error('Compression failed: ' + (err.message || 'Unknown error'));
    } finally {
      setCompressing(false);
    }
  };

  // Send message
  const handleSend = useCallback(async () => {
    if ((!inputText.trim() && attachments.length === 0) || streaming) return;

    let convId = activeConvId;

    // Auto-create conversation if none active
    if (!convId) {
      try {
        const conv = await api.createConversation({
          provider_id: selectedProvider,
          model: selectedModel,
        });
        convId = conv.id;
        setConversations(prev => [conv, ...prev]);
        setActiveConvId(convId);
        setActiveConv(conv);
      } catch {
        message.error('Failed to create conversation');
        return;
      }
    }

    const userContent = inputText.trim();
    const userAttachments = attachments.length > 0 ? [...attachments] : null;

    // Add user message optimistically
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userContent,
      attachments: userAttachments,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setInputText('');
    setAttachments([]);
    setStreaming(true);

    // Add placeholder assistant message
    const tempAssistantMsg = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempAssistantMsg]);

    try {
      const reader = await api.sendMessageStream(convId, {
        content: userContent,
        attachments: userAttachments,
        skills: selectedSkills.length > 0 ? selectedSkills : undefined,
        mode: chatMode,
      });

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr.trim()) continue;

          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'text') {
              fullText += data.text;
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  msgs[msgs.length - 1] = { ...last, content: fullText, id: data.messageId || last.id };
                }
                return msgs;
              });
            } else if (data.type === 'tool_call_start') {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant') {
                  const toolCalls = [...(last.tool_calls || []), { name: data.name, arguments: data.arguments, status: 'calling' }];
                  msgs[msgs.length - 1] = { ...last, tool_calls: toolCalls };
                }
                return msgs;
              });
            } else if (data.type === 'tool_result') {
              setMessages(prev => {
                const msgs = [...prev];
                const last = msgs[msgs.length - 1];
                if (last && last.role === 'assistant' && last.tool_calls) {
                  const toolCalls = [...last.tool_calls];
                  const tc = toolCalls.find(t => t.name === data.name && t.status === 'calling');
                  if (tc) {
                    tc.status = data.error ? 'error' : 'done';
                    tc.result = data.error || (typeof data.result === 'string' ? data.result : JSON.stringify(data.result));
                  }
                  msgs[msgs.length - 1] = { ...last, tool_calls: toolCalls };
                }
                return msgs;
              });
            } else if (data.type === 'done') {
              if (data.contextInfo) setContextInfo(data.contextInfo);
            } else if (data.type === 'error') {
              message.error(data.error);
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Auto-generate title for first message
      if (messages.length === 0 && userContent) {
        const title = userContent.length > 40 ? userContent.slice(0, 40) + '...' : userContent;
        api.updateConversation(convId, { title }).then(() => {
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, title } : c));
          setActiveConv(prev => prev ? { ...prev, title } : prev);
        });
      }

    } catch (err) {
      message.error('Failed to send message: ' + err.message);
      // Remove placeholder
      setMessages(prev => prev.filter(m => m.id !== tempAssistantMsg.id));
    } finally {
      setStreaming(false);
      loadConversations();
    }
  }, [inputText, attachments, activeConvId, selectedProvider, selectedModel, selectedSkills, streaming, messages.length, chatMode]);

  // Handle file upload
  const handleFileUpload = async (file) => {
    try {
      const result = await api.uploadFile(file);
      setAttachments(prev => [...prev, result]);
      message.success(`Uploaded: ${file.name}`);
    } catch {
      message.error('Upload failed');
    }
    return false; // Prevent default upload
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  // Handle paste with files (Ctrl+V images/files)
  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.kind === 'file') {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFileUpload(file);
      }
    }
  }, []);

  // Handle drag & drop files
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer?.files;
    if (files) Array.from(files).forEach(handleFileUpload);
  }, []);

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Copy message content
  const copyMessage = (content) => {
    navigator.clipboard.writeText(content);
    message.success('Copied');
  };

  // Skill management
  const toggleSkillSelection = (skillId) => {
    setSelectedSkills(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  const handleAddSkill = async () => {
    if (!newSkillName.trim() || !newSkillPrompt.trim()) return;
    try {
      const id = await api.createSkill({ name: newSkillName.trim(), prompt_template: newSkillPrompt.trim(), enabled: true });
      setSkills(prev => [...prev, { id, name: newSkillName.trim(), prompt_template: newSkillPrompt.trim(), enabled: 1 }]);
      setNewSkillName('');
      setNewSkillPrompt('');
      setEditingSkill(null);
      message.success('Skill added');
    } catch {
      message.error('Failed to add skill');
    }
  };

  const handleToggleSkillEnabled = async (skill) => {
    const enabled = !skill.enabled;
    try {
      await api.updateSkill(skill.id, { ...skill, enabled });
      setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, enabled: enabled ? 1 : 0 } : s));
      if (!enabled) setSelectedSkills(prev => prev.filter(id => id !== skill.id));
    } catch {
      message.error('Failed to update skill');
    }
  };

  const handleDeleteSkill = async (skillId) => {
    try {
      await api.deleteSkill(skillId);
      setSkills(prev => prev.filter(s => s.id !== skillId));
      setSelectedSkills(prev => prev.filter(id => id !== skillId));
    } catch {
      message.error('Failed to delete skill');
    }
  };

  // Install a skill from the store catalog
  const handleInstallStoreSkill = async (storeSkill) => {
    // Check if already installed (by name)
    if (skills.some(s => s.name === storeSkill.name)) {
      message.warning(`"${storeSkill.name}" is already installed`);
      return;
    }
    try {
      const result = await api.createSkill({
        name: storeSkill.name,
        description: storeSkill.description,
        prompt_template: storeSkill.prompt_template,
        enabled: true,
      });
      setSkills(prev => [...prev, result]);
      message.success(`Installed "${storeSkill.name}"`);
    } catch {
      message.error('Failed to install skill');
    }
  };

  // Import skill(s) from URL
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const handleImportFromUrl = async () => {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const result = await api.importSkills(importUrl.trim());
      if (result.imported) {
        setSkills(prev => [...prev, ...result.imported]);
        message.success(`Imported ${result.imported.length} skill(s)`);
        setImportUrl('');
      } else {
        message.error(result.error || 'Import failed');
      }
    } catch {
      message.error('Failed to import from URL');
    } finally {
      setImporting(false);
    }
  };

  // Search conversations
  useEffect(() => {
    const timer = setTimeout(() => loadConversations(searchText || undefined), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Render message content with markdown
  const renderToolCalls = (toolCalls) => {
    if (!toolCalls || toolCalls.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
        {toolCalls.map((tc, i) => (
          <div key={i} style={{
            padding: '6px 10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
            fontSize: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ToolOutlined style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 500 }}>{tc.name}</span>
              {tc.status === 'calling' && <Spin size="small" style={{ marginLeft: 4 }} />}
              {tc.status === 'done' && <CheckOutlined style={{ color: 'var(--success-color, #52c41a)', marginLeft: 4 }} />}
              {tc.status === 'error' && <CloseOutlined style={{ color: 'var(--error-color, #ff4d4f)', marginLeft: 4 }} />}
            </div>
            {tc.arguments && (
              <div style={{ marginTop: 4, color: 'var(--text-tertiary)', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto' }}>
                {typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments, null, 2)}
              </div>
            )}
            {tc.result && (
              <div style={{ marginTop: 4, color: tc.status === 'error' ? 'var(--error-color, #ff4d4f)' : 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: 4 }}>
                {tc.result.length > 500 ? tc.result.slice(0, 500) + '...' : tc.result}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderMessageContent = (msg) => {
    if (msg.role === 'assistant' && !msg.content && !msg.tool_calls && streaming) {
      return (
        <div className="chat-typing-indicator">
          <span>Thinking</span>
          <div className="chat-typing-dots"><span /><span /><span /></div>
        </div>
      );
    }

    return (
      <>
        {renderToolCalls(msg.tool_calls)}
        {msg.content && (
          <div className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
          </div>
        )}
      </>
    );
  };

  const isImage = (mimetype) => mimetype?.startsWith('image/');
  const isPdf = (mimetype) => mimetype === 'application/pdf';
  const isText = (mimetype) => mimetype?.startsWith('text/') || ['application/json', 'application/xml', 'application/javascript'].includes(mimetype);

  const getFileIcon = (mimetype) => {
    if (!mimetype) return <FileUnknownOutlined />;
    if (mimetype.startsWith('image/')) return <FileImageOutlined />;
    if (mimetype === 'application/pdf') return <FilePdfOutlined />;
    if (mimetype.includes('zip') || mimetype.includes('tar') || mimetype.includes('rar') || mimetype.includes('compress')) return <FileZipOutlined />;
    if (mimetype.includes('excel') || mimetype.includes('spreadsheet')) return <FileExcelOutlined />;
    if (mimetype.includes('word') || mimetype.includes('document')) return <FileWordOutlined />;
    if (isText(mimetype)) return <FileTextOutlined />;
    return <FileUnknownOutlined />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render a single attachment in a message
  const renderAttachment = (att, idx, inUserBubble) => {
    if (isImage(att.mimetype)) {
      return (
        <div key={idx} className="chat-att-image-wrap">
          <Image
            src={att.url}
            alt={att.name}
            width={180}
            style={{ borderRadius: 6, maxHeight: 160, objectFit: 'cover' }}
            placeholder={<div className="chat-att-image-placeholder">Loading...</div>}
          />
          <div className="chat-att-image-name">{att.name}</div>
        </div>
      );
    }

    // Clickable file card
    const canPreview = isPdf(att.mimetype) || isText(att.mimetype) || isImage(att.mimetype);
    return (
      <a
        key={idx}
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`chat-att-file ${inUserBubble ? 'chat-att-file-user' : ''}`}
        title={canPreview ? 'Click to preview' : 'Click to download'}
      >
        <div className="chat-att-file-icon">
          {getFileIcon(att.mimetype)}
        </div>
        <div className="chat-att-file-info">
          <div className="chat-att-file-name">{att.name}</div>
          <div className="chat-att-file-meta">
            {formatFileSize(att.size)}
            {canPreview && <span className="chat-att-file-action"><EyeOutlined /> Preview</span>}
          </div>
        </div>
      </a>
    );
  };

  const enabledProviders = providers.filter(p => p.enabled);

  // Save conversation settings
  const saveConvSettings = useCallback((updates) => {
    if (!activeConvId) return;
    api.updateConversation(activeConvId, updates).then(data => {
      setActiveConv(prev => ({ ...prev, ...updates }));
    });
  }, [activeConvId]);

  return (
    <div className="chat-layout">
      {/* Conversation Sidebar */}
      <div className={`chat-sidebar ${sidebarCollapsed ? 'chat-sidebar-collapsed' : ''}`}>
        <div className="chat-sidebar-header">
          {!sidebarCollapsed && (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleNewConversation} block>
                New Chat
              </Button>
              <Input
                placeholder="Search chats..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                size="small"
                style={{ marginTop: 8 }}
              />
            </>
          )}
          {sidebarCollapsed && (
            <Tooltip title="New Chat" placement="right">
              <Button type="primary" icon={<PlusOutlined />} onClick={handleNewConversation} />
            </Tooltip>
          )}
        </div>

        <div className="chat-sidebar-list">
          {convListLoading ? (
            <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
          ) : conversations.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>
              No conversations yet
            </div>
          ) : conversations.map(conv => (
            <div
              key={conv.id}
              className={`chat-sidebar-item ${activeConvId === conv.id ? 'active' : ''}`}
              onClick={() => setActiveConvId(conv.id)}
            >
              {editingTitle === conv.id ? (
                <div className="chat-sidebar-item-edit" onClick={e => e.stopPropagation()}>
                  <Input
                    size="small"
                    value={editTitleValue}
                    onChange={e => setEditTitleValue(e.target.value)}
                    onPressEnter={() => handleRenameConversation(conv.id)}
                    autoFocus
                  />
                  <Button size="small" type="text" icon={<CheckOutlined />} onClick={() => handleRenameConversation(conv.id)} />
                  <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setEditingTitle(null)} />
                </div>
              ) : (
                <>
                  <MessageOutlined style={{ fontSize: 14, flexShrink: 0, color: 'var(--text-tertiary)' }} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="chat-sidebar-item-title">{conv.title || 'New Chat'}</span>
                      <div className="chat-sidebar-item-actions">
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={e => { e.stopPropagation(); setEditingTitle(conv.id); setEditTitleValue(conv.title || ''); }}
                        />
                        <Popconfirm
                          title="Delete this conversation?"
                          onConfirm={e => { e?.stopPropagation(); handleDeleteConversation(conv.id); }}
                          onCancel={e => e?.stopPropagation()}
                        >
                          <Button size="small" type="text" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                        </Popconfirm>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className="chat-sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {sidebarCollapsed ? '→' : '←'}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="chat-main">
        {!activeConvId && messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="chat-welcome-icon">
              <RobotOutlined />
            </div>
            <h2>Start a Conversation</h2>
            <p>Choose a provider and start chatting with AI. You can upload files, select skills, and view conversation history.</p>
            <div className="chat-welcome-actions">
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleNewConversation}>
                New Chat
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header - Provider/Model selector */}
            <div className="chat-header">
              <div className="chat-header-left">
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
                  {activeConv?.title || 'New Chat'}
                </h3>
              </div>
              <div className="chat-header-right">
                <Select
                  placeholder="Provider"
                  value={selectedProvider}
                  onChange={val => {
                    setSelectedProvider(val);
                    const prov = providers.find(p => p.id === val);
                    // Always switch model to the provider's default
                    const newModel = prov?.default_model || '';
                    setSelectedModel(newModel);
                    if (activeConvId) api.updateConversation(activeConvId, { provider_id: val, model: newModel });
                  }}
                  options={enabledProviders.map(p => ({ value: p.id, label: p.name }))}
                  style={{ width: 160 }}
                  size="small"
                  allowClear
                />
                <AutoComplete
                  placeholder="Model"
                  value={selectedModel || ''}
                  onChange={val => {
                    setSelectedModel(val);
                    if (activeConvId) api.updateConversation(activeConvId, { model: val });
                  }}
                  options={buildModelOptions(providers.find(p => p.id === selectedProvider)?.type || '')}
                  filterOption={(input, option) =>
                    (option?.value || '').toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                  style={{ width: 200 }}
                  size="small"
                />
                <Tooltip title="Model Settings">
                  <Button
                    type="text"
                    icon={<SettingOutlined />}
                    onClick={() => setSettingsOpen(true)}
                    size="small"
                  />
                </Tooltip>
              </div>
            </div>

            {/* Settings Drawer */}
            <Drawer
              title="Conversation Settings"
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              width={400}
            >
              <div className="chat-settings">
                <div className="chat-settings-section">
                  <label className="chat-settings-label">
                    <ExperimentOutlined style={{ marginRight: 6 }} />
                    Role / System Prompt
                  </label>
                  <div className="chat-settings-presets">
                    {PRESET_ROLES.map(role => (
                      <div
                        key={role.label}
                        className={`chat-preset-chip ${systemPrompt === role.value ? 'active' : ''}`}
                        onClick={() => {
                          setSystemPrompt(role.value);
                          saveConvSettings({ system_prompt: role.value });
                        }}
                      >
                        <span>{role.label}</span>
                        <span className="chat-preset-desc">{role.description}</span>
                      </div>
                    ))}
                  </div>
                  <TextArea
                    placeholder="Custom system prompt... (defines the AI's role and behavior)"
                    value={systemPrompt}
                    onChange={e => setSystemPrompt(e.target.value)}
                    onBlur={() => saveConvSettings({ system_prompt: systemPrompt })}
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    style={{ marginTop: 8 }}
                  />
                </div>

                <div className="chat-settings-section">
                  <label className="chat-settings-label">Temperature</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Slider
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature ?? 1}
                      onChange={val => setTemperature(val)}
                      onChangeComplete={val => saveConvSettings({ temperature: val })}
                      style={{ flex: 1 }}
                    />
                    <InputNumber
                      min={0}
                      max={2}
                      step={0.1}
                      value={temperature ?? 1}
                      onChange={val => { setTemperature(val); saveConvSettings({ temperature: val }); }}
                      size="small"
                      style={{ width: 70 }}
                    />
                  </div>
                  <div className="chat-settings-hint">
                    Lower = more focused, Higher = more creative
                  </div>
                </div>

                <div className="chat-settings-section">
                  <label className="chat-settings-label">Max Tokens</label>
                  <InputNumber
                    min={1}
                    max={200000}
                    step={256}
                    value={maxTokens}
                    onChange={val => { setMaxTokens(val); saveConvSettings({ max_tokens: val }); }}
                    placeholder="Default (no limit)"
                    style={{ width: '100%' }}
                  />
                  <div className="chat-settings-hint">
                    Maximum number of tokens in the response
                  </div>
                </div>

                <div className="chat-settings-section">
                  <label className="chat-settings-label">
                    <CompressOutlined style={{ marginRight: 6 }} />
                    Memory Management
                  </label>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13 }}>Context Limit</span>
                      <InputNumber
                        min={5}
                        max={50}
                        value={contextLimit}
                        onChange={val => { setContextLimit(val); saveConvSettings({ context_limit: val }); }}
                        size="small"
                        style={{ width: 70 }}
                      />
                    </div>
                    <div className="chat-settings-hint">
                      Max messages sent to AI per request (older messages get summarized)
                    </div>
                  </div>
                </div>

              </div>
            </Drawer>

            {/* Messages */}
            <div className="chat-messages" ref={messagesContainerRef}>
              {loadingMore && (
                <div className="chat-messages-loading-more">
                  <Spin size="small" /> Loading earlier messages...
                </div>
              )}
              {messages.length === 0 && !loadingMore && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                  <MessageOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                  Send a message to start the conversation
                </div>
              )}
              {messages.map((msg, idx) => (
                msg.is_summary ? (
                  <div key={msg.id || idx} className="chat-message chat-message-summary">
                    <div className="chat-message-bubble chat-summary-bubble">
                      <div className="chat-message-header">
                        <span className="chat-summary-badge"><CompressOutlined /> Conversation Summary</span>
                        {msg.created_at && (
                          <span className="chat-message-time">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                <div key={msg.id || idx} className={`chat-message chat-message-${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="chat-message-avatar">
                      <RobotOutlined />
                    </div>
                  )}
                  <div className="chat-message-bubble">
                    <div className="chat-message-header">
                      <span className="chat-message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                      {msg.created_at && (
                        <span className="chat-message-time">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="chat-message-attachments">
                        {msg.attachments.map((att, i) => renderAttachment(att, i, msg.role === 'user'))}
                      </div>
                    )}
                    {renderMessageContent(msg)}
                    {msg.role === 'assistant' && msg.content && (
                      <div className="chat-message-actions">
                        <Tooltip title="Copy">
                          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copyMessage(msg.content)} />
                        </Tooltip>
                      </div>
                    )}
                  </div>
                </div>
                )
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Context Info Bar */}
            {contextInfo && activeConvId && (
              <div className="chat-context-bar">
                <div className="chat-context-stats">
                  <span className="chat-context-stat">
                    <DatabaseOutlined />
                    <span>{contextInfo.contextMessages}/{contextInfo.totalMessages} in context</span>
                  </span>
                  <span className="chat-context-stat">
                    <InfoCircleOutlined />
                    <span>~{(contextInfo.estimatedTokens || 0).toLocaleString()} tokens</span>
                  </span>
                  {contextInfo.hasSummary && (
                    <span className="chat-context-badge">Summary active</span>
                  )}
                </div>
                <div className="chat-context-actions">
                  {(contextInfo.compressRecommended || contextInfo.totalMessages > contextInfo.contextMessages) && (
                    <Tooltip title="Summarize older messages to free context space">
                      <Button
                        size="small"
                        type="link"
                        icon={<CompressOutlined />}
                        onClick={handleCompress}
                        loading={compressing}
                      >
                        Compress
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div
              className={`chat-input-area ${dragOver ? 'chat-input-dragover' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="chat-input-attachments">
                  {attachments.map((att, i) => isImage(att.mimetype) ? (
                    <div key={i} className="chat-input-attachment-image">
                      <img src={att.url} alt={att.name} className="chat-input-att-preview" />
                      <Button
                        size="small"
                        type="text"
                        className="chat-input-att-remove"
                        icon={<CloseOutlined />}
                        onClick={() => removeAttachment(i)}
                      />
                    </div>
                  ) : (
                    <div key={i} className="chat-input-attachment">
                      <div className="chat-input-att-icon">{getFileIcon(att.mimetype)}</div>
                      <div className="chat-input-att-info">
                        <span className="chat-input-att-name">{att.name}</span>
                        {att.size && <span className="chat-input-att-size">{formatFileSize(att.size)}</span>}
                      </div>
                      <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => removeAttachment(i)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Toolbar: skills + mode */}
              <div className="chat-input-toolbar">
                <div className="chat-skills-bar">
                  {skills.filter(s => s.enabled).length > 0 && (
                    <Tooltip title={selectedSkills.length === skills.filter(s => s.enabled).length ? 'Deselect All' : 'Select All'}>
                      <div
                        className={`chat-skill-chip ${selectedSkills.length === skills.filter(s => s.enabled).length ? 'active' : ''}`}
                        onClick={() => {
                          const enabledIds = skills.filter(s => s.enabled).map(s => s.id);
                          setSelectedSkills(prev => prev.length === enabledIds.length ? [] : enabledIds);
                        }}
                      >
                        <ThunderboltOutlined />
                        <span>All</span>
                      </div>
                    </Tooltip>
                  )}
                  {skills.filter(s => s.enabled).map(s => (
                    <div
                      key={s.id}
                      className={`chat-skill-chip ${selectedSkills.includes(s.id) ? 'active' : ''}`}
                      onClick={() => toggleSkillSelection(s.id)}
                    >
                      <ThunderboltOutlined />
                      <span>{s.name}</span>
                    </div>
                  ))}
                  <Tooltip title="Manage Skills">
                    <div
                      className="chat-skill-chip chat-skill-manage"
                      onClick={() => setSkillsManagerOpen(true)}
                    >
                      <AppstoreOutlined />
                    </div>
                  </Tooltip>
                </div>

                <div className="chat-mode-toggle">
                  <div
                    className={`chat-mode-btn ${chatMode === 'chat' ? 'active' : ''}`}
                    onClick={() => setChatMode('chat')}
                  >
                    <MessageOutlined />
                    <span>Chat</span>
                  </div>
                  <div
                    className={`chat-mode-btn ${chatMode === 'plan' ? 'active' : ''}`}
                    onClick={() => setChatMode('plan')}
                  >
                    <BulbOutlined />
                    <span>Plan</span>
                  </div>
                  <div
                    className={`chat-mode-btn ${chatMode === 'edit' ? 'active' : ''}`}
                    onClick={() => setChatMode('edit')}
                  >
                    <FormOutlined />
                    <span>Edit</span>
                  </div>
                </div>
              </div>

              <div className="chat-input-box">
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  multiple
                  onChange={e => {
                    Array.from(e.target.files).forEach(handleFileUpload);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="text"
                  icon={<PaperClipOutlined />}
                  onClick={() => fileInputRef.current?.click()}
                  className="chat-input-attach-btn"
                />
                <TextArea
                  ref={inputRef}
                  placeholder="Type a message... (Ctrl+V to paste files, drag & drop supported)"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  autoSize={{ minRows: 1, maxRows: 6 }}
                  className="chat-input-textarea"
                  disabled={streaming}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={streaming}
                  disabled={!inputText.trim() && attachments.length === 0}
                  className="chat-input-send-btn"
                />
              </div>
            </div>

            {/* Skills Manager Drawer */}
            <Drawer
              title="Skills"
              open={skillsManagerOpen}
              onClose={() => { setSkillsManagerOpen(false); setEditingSkill(null); setNewSkillName(''); setNewSkillPrompt(''); }}
              width={480}
            >
              <Tabs
                defaultActiveKey="installed"
                size="small"
                items={[
                  {
                    key: 'installed',
                    label: <span><ThunderboltOutlined /> Installed ({skills.length})</span>,
                    children: (
                      <div className="skills-manager">
                        {/* Add new skill */}
                        <div className="skills-manager-add">
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>Create Custom Skill</h4>
                          <Input
                            placeholder="Skill name"
                            value={newSkillName}
                            onChange={e => setNewSkillName(e.target.value)}
                            size="small"
                            style={{ marginBottom: 6 }}
                          />
                          <TextArea
                            placeholder="Prompt template... (the instruction prepended to your message)"
                            value={newSkillPrompt}
                            onChange={e => setNewSkillPrompt(e.target.value)}
                            autoSize={{ minRows: 2, maxRows: 5 }}
                            size="small"
                          />
                          <Button
                            type="primary"
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={handleAddSkill}
                            disabled={!newSkillName.trim() || !newSkillPrompt.trim()}
                            style={{ marginTop: 8 }}
                          >
                            Add
                          </Button>
                        </div>

                        {/* Import from URL */}
                        <div className="skills-manager-import">
                          <h4 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}><LinkOutlined /> Import from URL</h4>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Input
                              placeholder="https://example.com/skills.json"
                              value={importUrl}
                              onChange={e => setImportUrl(e.target.value)}
                              onPressEnter={handleImportFromUrl}
                              size="small"
                              style={{ flex: 1 }}
                            />
                            <Button
                              size="small"
                              icon={<CloudDownloadOutlined />}
                              onClick={handleImportFromUrl}
                              loading={importing}
                              disabled={!importUrl.trim()}
                            >
                              Import
                            </Button>
                          </div>
                          <div className="skills-manager-hint">
                            JSON format: {'{'} "name", "prompt_template" {'}'} or array
                          </div>
                        </div>

                        {/* Skill list */}
                        <div className="skills-manager-list">
                          {skills.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)', fontSize: 13 }}>
                              No skills installed. Create one above or browse the Store.
                            </div>
                          ) : skills.map(s => (
                            <div key={s.id} className="skills-manager-item">
                              <div className="skills-manager-item-info">
                                <div className="skills-manager-item-header">
                                  <ThunderboltOutlined style={{ color: s.enabled ? 'var(--color-primary)' : 'var(--text-tertiary)' }} />
                                  <span className="skills-manager-item-name">{s.name}</span>
                                </div>
                                <div className="skills-manager-item-prompt">{s.prompt_template}</div>
                              </div>
                              <div className="skills-manager-item-actions">
                                <Switch
                                  size="small"
                                  checked={!!s.enabled}
                                  onChange={() => handleToggleSkillEnabled(s)}
                                />
                                <Popconfirm title="Delete this skill?" onConfirm={() => handleDeleteSkill(s.id)}>
                                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: 'store',
                    label: <span><AppstoreOutlined /> Store</span>,
                    children: (
                      <div className="skills-store">
                        {SKILL_STORE.map(cat => (
                          <div key={cat.category} className="skills-store-category">
                            <h4 className="skills-store-category-title">{cat.category}</h4>
                            <div className="skills-store-grid">
                              {cat.items.map(item => {
                                const installed = skills.some(s => s.name === item.name);
                                return (
                                  <div key={item.name} className={`skills-store-card ${installed ? 'installed' : ''}`}>
                                    <div className="skills-store-card-info">
                                      <div className="skills-store-card-name">{item.name}</div>
                                      <div className="skills-store-card-desc">{item.description}</div>
                                    </div>
                                    <Button
                                      size="small"
                                      type={installed ? 'default' : 'primary'}
                                      icon={installed ? <CheckOutlined /> : <DownloadOutlined />}
                                      onClick={() => !installed && handleInstallStoreSkill(item)}
                                      disabled={installed}
                                    >
                                      {installed ? 'Installed' : 'Install'}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </Drawer>
          </>
        )}
      </div>
    </div>
  );
}
