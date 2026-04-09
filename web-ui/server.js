const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let cliProcess = null;

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('start_cli', (config) => {
        if (cliProcess) {
            cliProcess.kill();
        }

        const { providerUrl, apiKey } = config;
        
        // Setup environment variables for the child process.
        const env = {
            ...process.env,
            ANTHROPIC_BASE_URL: providerUrl || process.env.ANTHROPIC_BASE_URL,
            ANTHROPIC_API_KEY: apiKey || process.env.ANTHROPIC_API_KEY,
            OPENAI_BASE_URL: providerUrl,
            OPENAI_API_KEY: apiKey,
            FORCE_COLOR: '1' 
        };

        const cliPath = path.join(__dirname, '..', 'package', 'cli.js');
        
        socket.emit('server_message', `Starting CLI: node ${cliPath}...`);
        cliProcess = spawn('node', [`"${cliPath}"`], {
            env: env,
            cwd: path.join(__dirname, '..', 'package'),
            shell: process.platform === 'win32'
        });

        cliProcess.stdout.on('data', (data) => {
            socket.emit('cli_output', data.toString());
        });

        cliProcess.stderr.on('data', (data) => {
            socket.emit('cli_error', data.toString());
        });

        cliProcess.on('close', (code) => {
            socket.emit('server_message', `CLI process exited with code ${code}`);
            cliProcess = null;
        });
    });

    socket.on('cli_input', (msg) => {
        if (cliProcess && cliProcess.stdin.writable) {
            cliProcess.stdin.write(msg + '\n');
        } else {
            socket.emit('server_message', 'CLI process is not running. Start it first.');
        }
    });

    socket.on('stop_cli', () => {
        if (cliProcess) {
            cliProcess.kill();
            cliProcess = null;
            socket.emit('server_message', 'CLI process forcefully stopped.');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web UI server listening on *:${PORT}`);
});
