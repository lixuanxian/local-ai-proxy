import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Select, Checkbox, Upload, Tooltip, Empty, Popconfirm, Dropdown, Badge, message, Spin, Drawer, Slider, InputNumber } from 'antd';
import {
  SendOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  PaperClipOutlined,
  SearchOutlined,
  MessageOutlined,
  RobotOutlined,
  UserOutlined,
  CheckOutlined,
  CloseOutlined,
  CopyOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  FileImageOutlined,
  DownOutlined,
  BulbOutlined,
  FormOutlined,
  SettingOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';

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

export default function Chat() {
  // State
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
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
  const [chatMode, setChatMode] = useState('edit'); // 'plan' or 'edit'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(null);
  const [maxTokens, setMaxTokens] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversations, providers, skills
  useEffect(() => {
    loadConversations();
    api.getProviders().then(setProviders).catch(() => {});
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

  // Load conversation messages when active changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      setActiveConv(null);
      return;
    }
    loadConversation(activeConvId);
  }, [activeConvId]);

  const loadConversation = async (id) => {
    try {
      const data = await api.getConversation(id);
      setActiveConv(data);
      setMessages(data.messages || []);
      if (data.provider_id) setSelectedProvider(data.provider_id);
      if (data.model) setSelectedModel(data.model);
      setSystemPrompt(data.system_prompt || '');
      setTemperature(data.temperature ?? null);
      setMaxTokens(data.max_tokens ?? null);
    } catch {
      message.error('Failed to load conversation');
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
            } else if (data.type === 'done') {
              // Streaming complete
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

  // Search conversations
  useEffect(() => {
    const timer = setTimeout(() => loadConversations(searchText || undefined), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Render message content with markdown
  const renderMessageContent = (msg) => {
    if (msg.role === 'assistant' && !msg.content && streaming) {
      return <div className="chat-typing-indicator"><span /><span /><span /></div>;
    }
    return (
      <div className="chat-markdown">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ''}</ReactMarkdown>
      </div>
    );
  };

  const isImage = (mimetype) => mimetype?.startsWith('image/');

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
                    if (activeConvId) api.updateConversation(activeConvId, { provider_id: val });
                  }}
                  style={{ width: 160 }}
                  size="small"
                  allowClear
                >
                  {enabledProviders.map(p => (
                    <Select.Option key={p.id} value={p.id}>
                      {p.name}
                    </Select.Option>
                  ))}
                </Select>
                <Input
                  placeholder="Model"
                  value={selectedModel || ''}
                  onChange={e => {
                    setSelectedModel(e.target.value);
                    if (activeConvId) api.updateConversation(activeConvId, { model: e.target.value });
                  }}
                  style={{ width: 160 }}
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
              </div>
            </Drawer>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)' }}>
                  <MessageOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                  Send a message to start the conversation
                </div>
              )}
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`chat-message chat-message-${msg.role}`}>
                  <div className="chat-message-avatar">
                    {msg.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  </div>
                  <div className="chat-message-content">
                    <div className="chat-message-header">
                      <span className="chat-message-role">{msg.role === 'user' ? 'You' : 'Assistant'}</span>
                      {msg.created_at && (
                        <span className="chat-message-time">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="chat-message-attachments">
                        {msg.attachments.map((att, i) => (
                          <div key={i} className="chat-attachment">
                            {isImage(att.mimetype) ? (
                              <img src={att.url} alt={att.name} className="chat-attachment-image" />
                            ) : (
                              <div className="chat-attachment-file">
                                <FileTextOutlined />
                                <span>{att.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
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
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="chat-input-area">
              {/* Attachments preview */}
              {attachments.length > 0 && (
                <div className="chat-input-attachments">
                  {attachments.map((att, i) => (
                    <div key={i} className="chat-input-attachment">
                      {isImage(att.mimetype) ? (
                        <img src={att.url} alt={att.name} />
                      ) : (
                        <FileTextOutlined style={{ fontSize: 20 }} />
                      )}
                      <span>{att.name}</span>
                      <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => removeAttachment(i)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Skills selector */}
              {skills.length > 0 && (
                <div className="chat-input-skills">
                  <ThunderboltOutlined style={{ color: 'var(--text-tertiary)', marginRight: 6 }} />
                  <Checkbox.Group
                    value={selectedSkills}
                    onChange={setSelectedSkills}
                    options={skills.filter(s => s.enabled).map(s => ({
                      label: s.name,
                      value: s.id,
                    }))}
                  />
                </div>
              )}

              {/* Mode toggle */}
              <div className="chat-mode-toggle">
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
                  placeholder="Type a message... (Shift+Enter for new line)"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
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
          </>
        )}
      </div>
    </div>
  );
}
