const chalk = require('chalk');
const stripAnsi = require('strip-ansi');

const COLOURS = {
    user: 'red',
    pwd: 'blue',
    command: 'cyan',
};
const PROMPT = `${chalk[COLOURS.user]('root')} @ ${chalk[COLOURS.pwd]('/')} > `;

const term = createTerminal();
setUpTermEventHandlers(term);
setUpShims(term);
setUpTermUi(term);

const commandHistory = [];
let historyIndex = 0;

// just attaching these for easy inspection on the fly
window.process = process;
window.term = term;

function createTerminal() {
    const Terminal = require('xterm').Terminal;
    const fit = require('xterm/lib/addons/fit/fit');
    Terminal.applyAddon(fit);

    const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: 'Consolas',
        fontSize: '16',
    });

    term.writeWithPrompt = function (...args) {
        this.writeln(...args);
        this.write(PROMPT);
        this.focus();
        this.showCursor();
    };
    term.newLine = function () {
        let value = this.textarea.value;
        this.textarea.value = "";
        this.emit('newline', { text: value });
    };

    return term;
}

function setUpTermEventHandlers(term) {

    term.on('key', (key, ev) => {
        if (process.running) {
            if (ev.ctrlKey && ev.key === 'c') {
                term.emit('SIGINT');
                return;
            }

            if (ev.key === 'ArrowUp') {
                ev.name = 'up';
            } else if (ev.key === 'ArrowDown') {
                ev.name = 'down';
            } else if (Number(ev.key)) {
                ev.value = ev.key;
            }
            if (ev.key === 'Enter') {
                // There's a wweird bug I'm experiencing
                // where the first two triggers of this 'line' event
                // are being ignored; hence the hack
                term.emit('line');
                term.emit('line');
                term.emit('line');
            } else {
                term.emit('keypress', key, ev);
            }
            return;
        }

        const printable = (
            !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
        );

        if (ev.key === 'Enter') {
            term.newLine();
        } else if (ev.key === 'Backspace') {
            // confession: this implementation of Backspace is buggy; 🙈
            // it only works when the cursor is at line's

            // don't delete the prompt!
            if (term.buffer.x > stripAnsi(PROMPT).length) {
                term.write('\b \b');
            }
            const value = term.textarea.value;
            term.textarea.value = value.slice(0, value.length - 1);
        } else if (ev.key === 'ArrowUp') {
            if (historyIndex > 0) {
                showHistoryItem(--historyIndex);
                console.log(historyIndex)
            }
        } else if (ev.key === 'ArrowDown') {
            if (historyIndex < commandHistory.length) {
                showHistoryItem(++historyIndex);
                console.log(historyIndex)
            }
        } else if (printable) {
            if (term.textarea.value.split(/\s+/).length < 2 && key !== ' ') {
                term.write(chalk[COLOURS.command](key));
            } else {
                term.write(key);
            }
        }
    });

    term.on('paste', function (data, ev) {
        term.write(data);
    });

    term.on('newline', (line) => {
        let argv = line.text.split(/\s+/);
        if (!argv[0]) {
            term.emit('line-processed');
            return;
        }

        // output should start from the next line
        term.write('\r\n');
        process.running = true;
        historyIndex = commandHistory.push(line.text);
        const recognisedCommands = ['shalvah'];
        if (!recognisedCommands.includes(argv[0])) {
            term.write('Unknown command: ' + argv[0]);
            term.emit('line-processed');
            return;
        }

        const program = require('commander');
        program.version('1.0.0')
            .description('Shalvah on your command-line')
            .parse([''].concat(argv));
        const shalvah = require('shalvah');
        const inquirer = require('inquirer');
        term.writeln(shalvah.bio);
        inquirer.prompt({
            name: 'link',
            type: 'list',
            message: shalvah.prompt,
            choices: shalvah.links.concat({
                'name': `...Or shoot me an email (${shalvah.email})`,
                'value': 'mailto:' + shalvah.email
            })
        }).then(answers => {
            term.writeln(`Opening ${answers.link}`);
            window.open(answers.link);
            term.emit('line-processed');
        });

    });

    term.on('line-processed', () => {
        term.writeWithPrompt('');
        process.running = false;
    });
}

function setUpShims(term) {
    /*
     * The most important shim. Used by both Commander and Inquirer.
     * We're tricking them into thinking xterm is a TTY
     */
    term.isTTY = true;
    process.stdout = process.stdin = process.stderr = term;

    /*
     * Shim process.exit so calling it actually halts execution. Used in Commander
     */
    process.exit = () => {
        term.emit('line-processed');
        throw 'process.exit';
    };
    window.onerror = (n, o, p, e, error) => {
        if (error === 'process.exit') {
            console.log(error);
            return true;
        }
    };

    /*
     * Required for Inquirer.js
     */
    process.binding = (name) => {
        return (name === 'constants') ? require('constants') : {};
    };
    process.versions = {
        node: '8.10.0',
        v8: '6.2.414.50'
    };

    /*
     * for inquirer.js to show the choice selection pointer (list prompt) properly
     */
    process.platform = 'win32';

    /*
     * For inquirer.js to exit when Ctrl-C is pressed
     */
    process.kill = () => {
        process.running = false;
        term.writeln('');
        term.writeWithPrompt('');
    };

    /*
     * Used by Commander for error responses
     * This is covers only my specific use cases
     * and tries to maintain regular console logs for other packages
     */
    let originalConsoleError = console.error.bind(console);
    console.error = (...args) => {
        if (!args.length) {
            term.writeln('');
        } else if (args[0].includes('error: unknown option')) {
            term.writeln(require('util').format(...args));
        } else {
            originalConsoleError(...args);
        }
    };
}

function setUpTermUi(term) {
    term.open(document.getElementById('terminal'));
    term.fit();
    term.writeWithPrompt('');
    term.focus();
}

function showHistoryItem(index) {
    let text = commandHistory[index] === undefined ? '' : commandHistory[index];
    let i = term.buffer.x;
    while (i > stripAnsi(PROMPT).length) {
        term.write('\b \b');
        i--;
    }
    const pieces = text.split(/\s+/);
    term.write(chalk[COLOURS.command](pieces.shift()));
    while (pieces.length) {
        term.write(' ' + pieces.shift());
    }
    term.textarea.value = text;
}
