'use strict';

const get = require('lodash.get');
const TRIM = /^\/*|\/*$/g;

const shalvah = (args) => {
    const program = require('commander');
    program.version('1.0.0')
        .description('Shalvah on your command-line')
        .parse(['', 'shalvah'].concat(args));
    const shalvah = require('shalvah');
    const inquirer = require('inquirer');
    process.stdout.write(shalvah.bio + '\r\n');
    inquirer.prompt({
        name: 'link',
        type: (screen.width > 600) ? 'list' : 'rawlist',
        message: shalvah.prompt,
        choices: shalvah.links.concat({
            'name': `...Or shoot me an email (${shalvah.email})`,
            'value': 'mailto:' + shalvah.email
        })
    }).then(answers => {
        process.stdout.write(`Opening ${answers.link}\r\n`);
        window.open(answers.link);
        process.stdout.emit('line-processed');
    });
};

const help = () => {
    process.stdout.write('Available commands: pwd, cd, ls, shalvah, help');
    process.stdout.emit('line-processed');
};

const exit = () => {
    if (window.sudo) {
        resetSudo();
        process.stdout.emit('line-processed');
    } else {
        process.stdout.write('Bye...\uD83D\uDC4B  ');
        setTimeout(window.close.bind(window), 700)
    }
};

const ls = (args) => {
    if (args[0] === undefined) {
        process.stdout.write(listContents(window.currentDirectory));
    } else {
        process.stdout.write(getContents(args[0]));
    }
    process.stdout.write('\r\n');
    process.stdout.emit('line-processed');
};

const cd = (args) => {
    if (args[0]) {
        changeDirectory(args[0]);
    }
    process.stdout.emit('line-processed');
};

const pwd = () => {
    process.stdout.write('/' + window.currentDirectoryPath + '\r\n');
    process.stdout.emit('line-processed');
};

const rm = (args) => {
    if (window.sudo || window.tempSudo) {
        process.stdout.write('Okay, you win \uD83D\uDE22 \r\n');
    } else {
        process.stdout.write('Nah, not today!\uD83D\uDE0E \r\n');
    }
    process.stdout.emit('line-processed');
};

function resolvePath(from, path) {
    let absPath;
    if (path.startsWith('/')) {
        absPath = path;
    } else if (path === '~' || path.startsWith('~/')) {
        absPath = 'root' + path.substring(1 /* '~'.length */);
    } else {
        absPath = from === '' ? path : `${from}/${path}`;
    }
    return absPath.replace(TRIM, '');
}

function changeDirectory(to) {
    if (to === '/') {
        window.currentDirectory = window.paths;
        window.currentDirectoryPath = '';
        return;
    }

    const newDirectoryPath = resolvePath(window.currentDirectoryPath, to);
    const newDirectory = get(window.paths, newDirectoryPath.split('/'));
    if (!newDirectory) {
        process.stdout.write(`No such file or directory: ${to}`);
        return;
    }

    window.currentDirectory = newDirectory;
    window.currentDirectoryPath = newDirectoryPath;
}

function listContents(directory) {
    // no files in our fake tree, so just add the slash to everyting
    return Object.keys(directory).map(s => s + '/').join(' ');
}

function getContents(path) {
    if (path === '/') {
        return listContents(window.paths);
    }

    let absPath = resolvePath(window.currentDirectoryPath, path);
    let target = get(window.paths, absPath.split('/'));
    if (!target) {
        return `Cannot access ${path}: no such file or directory`;
    }

    return listContents(target);
}

function resetSudo() {
    window.PROMPT_CHAR = '>';
    window.sudo = false;
}

module.exports = {
    shalvah,
    help,
    ls,
    exit,
    cd,
    pwd,
    rm
};
