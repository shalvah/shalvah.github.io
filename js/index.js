const chalk = require('chalk');

const COLOURS = {
    user: 'red',
    pwd: 'blue',
    command: 'cyan',
};
window.PROMPT_CHAR = '>';
const PROMPT = () => {
    let pwd = window.hasChangedDirectory ? '/' + window.currentDirectoryPath : '~';
    window.rawPrompt = `root @ ${pwd} ${PROMPT_CHAR} `;
    return `${chalk[COLOURS.user]('root')} @ ${chalk[COLOURS.pwd](pwd)} ${PROMPT_CHAR} `;
};

const term = createTerminal();
setUpTermEventHandlers();
setUpShims();
setUpTermUi();
setTimeout(startTerminalSession, 500);

const commandHistory = [];
let historyIndex = 0;
window.paths = {
    bin: {},
    boot: {},
    dev: {},
    etc: {},
    home: {},
    lib: {},
    mnt: {},
    root: {'.ssh': {} },
    usr: {bin: {}, lib: {}},
    var: {log: {}}
};
window.currentDirectory = window.paths.root;
window.currentDirectoryPath = 'root';

// just attaching these for easy inspection on the fly
window.process = process;
window.term = term;

function createTerminal() {
    const Terminal = require('xterm').Terminal;

    // make the terminal window responsive: calculate how many rows and cols it needs
    const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontFamily: "monospace",
        fontSize: '14',
        rows: calculateNumberOfTerminalRows(),
        cols: calculateNumberOfTerminalCols(),
    });

    term.writeThenPrompt = function (...args) {
        this.writeln(...args);
        this.write(PROMPT());
        this.focus();
        this.showCursor();
    };

    term.newLine = function () {
        let value = this.textarea.value;
        this.textarea.value = "";
        this.emit('newline', { text: value });
    };

    return term;

    /*
     * This measures the height of a single character using a div's height
     * and uses that to figure out how many rows can fit in about 80% of the screen
     */
    function calculateNumberOfTerminalRows() {
        let testElement = document.createElement('div');
        testElement.innerText = 'h';
        testElement.style.visibility = 'hidden';
        document.querySelector('.term-container').append(testElement);
        testElement.style.fontSize = '14px';
        let fontHeight = testElement.clientHeight + 1;
        testElement.remove();
        return Math.floor(screen.availHeight * 0.8 / fontHeight) - 2;
    }

    /*
     * This measures the width of a single character using canvas
     * and uses that to figure out how many columns can fit in about 60% (80% for mobile) of the screen
     */
    function calculateNumberOfTerminalCols() {
        const ctx = document.createElement("canvas").getContext('2d');
        ctx.font = '14px monospace';
        const fontWidth = ctx.measureText('h').width + 1;
        const screenWidth = screen.availWidth;
        return Math.floor(screenWidth * ((screenWidth > 600) ? 0.6 : 0.8) / fontWidth) + 3;
    }

}

function setUpTermEventHandlers() {

    term.attachCustomKeyEventHandler((ev) => {
        if (process.running) {
            if (ev.key === 'ArrowUp') {
                ev.name = 'up';
            } else if (ev.key === 'ArrowDown') {
                ev.name = 'down';
            } else if (Number(ev.key)) {
                ev.value = ev.key;
                term.write(ev.key);

                // emit this for inquirer
                term.emit('keypress');

                // stop propagation
                return false;
            }
        }
    });

    term.on('key', (key, ev) => {
        const isPrintable = (
            !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
        );

        if (process.running) {
            if (ev.ctrlKey && ev.key === 'c') {
                term.emit('SIGINT');
                return;
            }

            if (ev.key === 'Enter') {
                // There's a wweird bug I'm experiencing
                // where the first two triggers of this 'line' event
                // are being ignored; hence the hack
                term.emit('line', term.textarea.value);
                term.emit('line', term.textarea.value);
                term.emit('line', term.textarea.value);
            } else if (ev.key === 'Backspace') {
                // confession: this implementation of Backspace is buggy; 🙈
                // it only works when the cursor is at line's

                // don't delete the prompt!
                if (term.buffer.x > window.rawPrompt.length) {
                    term.write('\b \b');
                }
                const value = term.textarea.value;
                term.textarea.value = value.slice(0, value.length - 1);
            } else {
                term.emit('keypress', key, ev);
            }
            return;
        }

        if (ev.key === 'Enter') {
            term.newLine();
        } else if (ev.key === 'Backspace') {
            // confession: this implementation of Backspace is buggy; 🙈
            // it only works when the cursor is at line's

            // don't delete the prompt!
            if (term.buffer.x > window.rawPrompt.length) {
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
        } else if (isPrintable) {
            if (term.textarea.value.split(/\s+/).length < 2 && key !== ' ') {
                term.write(chalk[COLOURS.command](key));
            } else {
                term.write(key);
            }
        }
    });

    // just because I'm a nice guy, I'll let folks paste commands
    term.on('paste', function (data, ev) {
        term.write(data);
    });

    term.on('newline', (line) => {
        const recognisedCommands = ['shalvah', 'help', 'ls', 'pwd', 'cd', 'exit', 'rm'];
        let argv = line.text.split(/\s+/);
        if (argv[0] === 'sudo') {
            argv.shift();
            if (argv[1] && recognisedCommands.includes(argv[1])) {
                window.tempSudo = true;
            } else {
                window.sudo = true;
                PROMPT_CHAR = '#';
            }

        }

        if (!argv[0]) {
            term.emit('line-processed');
            return;

        }
        // output should start from the next line
        term.write('\r\n');
        process.running = true;
        historyIndex = commandHistory.push(line.text);
        if (!recognisedCommands.includes(argv[0])) {
            term.writeln('Unknown command: ' + argv[0]);
            term.emit('line-processed');
            return;
        }

        let program = require('./programs')[argv.shift()];
        program(argv);
    });

    term.on('line-processed', () => {
        window.tempSudo && (window.tempSudo = false);
        term.writeThenPrompt('');
        process.running = false;
    });
}

/*
 * Be warned:
 * 1. Not all shims are in this function. Some are spread across other functions
 * 2. These shims are specific to my use case.
 *    They don't bring full Inquirer/Commander compatibility to xterm,
 *    only compatibility for the functions I needed
 */
function setUpShims() {
    /*
     * Is another program currently in the foreground (for instance, Inquirer.js)?
     * Who am I kidding, that's the only example on this site.
     */
    process.running = false;

    /*
     * The most important shim. Used by both Commander and Inquirer.
     * We're tricking them into thinking xterm is a TTY
     */
    term.isTTY = true;

    /*
     * Xterm is both our input and output
     */
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
        term.writeThenPrompt('');
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

function setUpTermUi() {
    const terminalElement = document.getElementById('terminal');
    term.open(terminalElement);
    const titleBarElement = document.querySelector('.title-bar');
    titleBarElement.style.width = terminalElement.clientWidth;
    titleBarElement.style.display = 'block';
    term.writeThenPrompt("Try playing around with the terminal to see what's available. If you're stuck, type 'help' for a list of commands. Type 'exit' to quit.\r\n");
    term.focus();
}

function showHistoryItem(index) {
    let text = commandHistory[index] === undefined ? '' : commandHistory[index];
    let i = term.buffer.x;
    while (i > window.rawPrompt.length) {
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

function startTerminalSession() {
    term.writeln(chalk[COLOURS.command]('npm') + ' install -g shalvah');
    term.writeln('added 1 package in 0.00s');
    term.writeThenPrompt('');
}

