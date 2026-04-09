const socket = io();
const ansiUp = new AnsiUp();

const chatHistory = document.getElementById('chatHistory');
const cmdInput = document.getElementById('cmdInput');
const sendBtn = document.getElementById('sendBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const providerUrlInput = document.getElementById('providerUrl');
const apiKeyInput = document.getElementById('apiKey');
const statusDot = document.getElementById('status-dot');

let isRunning = false;

function scrollToBottom() {
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

function appendMessage(type, text, isHtml = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    
    if (isHtml) {
        msgDiv.innerHTML = text;
    } else {
        msgDiv.textContent = text;
    }
    
    chatHistory.appendChild(msgDiv);
    scrollToBottom();
}

socket.on('server_message', (msg) => {
    appendMessage('server-msg', msg);
    if (msg.includes('exited') || msg.includes('stopped')) {
        isRunning = false;
        statusDot.classList.remove('active');
        startBtn.disabled = false;
    } else if (msg.includes('Starting CLI')) {
        isRunning = true;
        statusDot.classList.add('active');
        startBtn.disabled = true;
    }
});

socket.on('cli_output', (data) => {
    const html = ansiUp.ansi_to_html(data);
    appendMessage('cli-output', html, true);
});

socket.on('cli_error', (data) => {
    const html = ansiUp.ansi_to_html(data);
    appendMessage('cli-error', html, true);
});

startBtn.addEventListener('click', () => {
    if (isRunning) return;
    const config = {
        providerUrl: providerUrlInput.value.trim(),
        apiKey: apiKeyInput.value.trim()
    };
    socket.emit('start_cli', config);
    appendMessage('server-msg', 'Sending initial configuration to server...');
});

stopBtn.addEventListener('click', () => {
    socket.emit('stop_cli');
});

function sendMessage() {
    const text = cmdInput.value.trim();
    if (text) {
        if (!isRunning) {
            appendMessage('server-msg', 'Please start the CLI first Using the side panel.');
            return;
        }
        
        appendMessage('user-msg', text);
        socket.emit('cli_input', text);
        cmdInput.value = '';
        cmdInput.style.height = 'auto'; // Reset height
    }
}

sendBtn.addEventListener('click', sendMessage);

cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Auto-resize textarea
cmdInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});
