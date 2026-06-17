/**
 * @license
 * [BSD-3-Clause](https://github.com/pryv/pryv-boiler/blob/master/LICENSE)
 */
const util = require('util');
const winston = require('winston');
require('winston-daily-rotate-file');
const debugModule = require('debug');
const { redact, redactString } = require('dev-newrelic-scrub');
let winstonInstance = null;
let rootLogger = null;
let customLoggerInstance = null;

// ------ winston formating

/**
 *
 * @param {Object} options
 * @param {boolean} options.color - set to true to have colors
 * @param {boolean} options.time - set to true to for timestamp
 * @param {boolean} options.align - set to true to allign logs items
 */
function generateFormat (options) {
  const formats = [];
  if (options.color) {
    formats.push(winston.format.colorize());
  }
  if (options.time) {
    formats.push(winston.format.timestamp());
  }
  if (options.align) {
    formats.push(winston.format.align());
  }

  function printf (info) {
    const { timestamp, level, message } = info;

    let items = info[Symbol.for('splat')] || {};

    let itemStr = '';
    if (items.length > 0) {
      let skip = false;
      if (items.length === 1) {
        if (typeof items[0] === 'undefined') {
          skip = true;
        } else {
          if (items[0] && items[0].context) {
            items = items[0].context;
          }
        }
      }
      if (!skip) { itemStr = util.inspect(items, { depth: 10, colors: true }); }
    }

    const line = `[${level}]: ${message} ${itemStr}`;

    if (options.time) {
      const ts = timestamp.slice(0, 19).replace('T', ' ');
      return ts + ' ' + line;
    } else {
      return line;
    }
  }
  formats.push(winston.format.printf(printf));
  return winston.format.combine(...formats);
}

/**
 * Helper to pass log instructions to winston
 */
function globalLog (level, key, message, context) {
  const text = `[${key}] ${message}`;
  if (winstonInstance) {
    winstonInstance[level](text, context);
  } else {
    console.log('Logger not initialized: ', ...arguments);
  }
  if (customLoggerInstance) {
    customLoggerInstance.log(level, key, message, context);
  }
}

/**
 * Config initialize Logger right after beeing loaded
 * This is done by config Only
 */
async function initLoggerWithConfig (config) {
  if (winstonInstance) {
    throw new Error('Logger was already initialized');
  }
  // console
  winstonInstance = winston.createLogger({ });
  const logConsole = config.get('logs:console');
  let isSilent = !config.get('logs:console:active');

  // LOGS env var can override settings
  if (process.env.LOGS) {
    logConsole.level = process.env.LOGS;
    isSilent = false;
  }

  const consoleFormat = generateFormat(logConsole.format);
  const myconsole = new winston.transports.Console({ format: consoleFormat, level: logConsole.level, silent: isSilent });
  winstonInstance.add(myconsole);

  rootLogger.debug((isSilent ? '** silent ** ' : '') + 'Console with level: ', logConsole.level);

  // file
  const logFile = config.get('logs:file');
  if (config.get('logs:file:active')) {
    const fileFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    );

    rootLogger.debug('File active: ' + logFile.path);
    if (logFile.rotation.isActive) {
      const rotatedFiles = new winston.transports.DailyRotateFile({
        filename: logFile.path + '.%DATE%',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        level: logFile.level,
        maxFiles: logFile.rotation.days ? logFile.rotation.days + 'd' : null,
        format: fileFormat
      });
      winstonInstance.add(rotatedFiles);
    } else {
      const files = new winston.transports.File({
        filename: logFile.path,
        level: logFile.level,
        maxSize: logFile.maxFileBytes || '10m',
        maxFiles: logFile.maxNbFiles || '14d',
        format: fileFormat
      });
      winstonInstance.add(files);
    }
  }

  // custom
  if (config.get('logs:custom:active')) {
    customLoggerInstance = require(config.get('logs:custom:path'));
    await customLoggerInstance.init(config.get('logs:custom:settings'));
  }

  // catch all errors.
  if (!config.get('logs:skipUncaughtException')) {
    process.on('uncaughtException', function (err) {
      rootLogger.error('UncaughtException', { message: err.message, name: err.name, stack: err.stack });
      throw err;
    });
  }

  rootLogger.debug('Logger Initialized');
}

// --------------- debug utils

/**
 * Dump objects with file and line
 */
function inspect () {
  let line = '';
  try {
    throw new Error();
  } catch (e) {
    line = e.stack.split(' at ')[2].trim();
  }
  let res = '\n * dump at: ' + line;
  for (let i = 0; i < arguments.length; i++) {
    res += '\n' + i + ' ' + util.inspect(arguments[i], true, 10, true) + '\n';
  }
  return res;
}

function setGlobalName (name) {
  // create root logger
  rootLogger = new Logger(name, null);
  rootLogger.debug('setGlobalName: ' + name);
}

class Logger {
  parent; // eventual parent
  debugInstance; // debug instance

  constructor (name, parent) {
    this.name = name;
    this.parent = parent;
    this.debugInstance = debugModule('pryv:' + this._name());
  }

  /**
   * Private
   */
  _name () {
    if (this.parent) return this.parent._name() + ':' + this.name;
    return this.name;
  }

  log () {
    const level = arguments[0];
    const rawMessage = arguments[1];
    const message = typeof rawMessage === 'string' ? redactString(rawMessage) : redact(rawMessage);
    const context = [];

    let meta;
    // Security measure: no PHI / secret may reach any transport (file, console,
    // forward sink). Redaction happens here, before globalLog fans out. See
    // dev-newrelic-scrub (origin: HIPAA monitoring / subprocessor posture).
    for (let i = 2; i < arguments.length; i++) {
      context.push(arguments[i] === undefined ? undefined : redact(arguments[i]));
    }
    if (context.length === 1) {
      meta = { context: context[0] };
    } else if (context.length > 1) {
      meta = { context };
    }
    globalLog(level, this._name(), message, meta);
  }

  info () { this.log('info', ...arguments); }
  warn () { this.log('warn', ...arguments); }
  error () { this.log('error', ...arguments); }
  debug () {
    if (winstonInstance) {
      this.log('debug', ...arguments);
    }
    this.debugInstance(...arguments);
  }

  /**
   * get a "sub" Logger
   * @param {Logger} name
   * @returns {Logger}
   */
  getLogger (name) {
    return new Logger(name, this);
  }

  inspect () { inspect(...arguments); }
}

/**
 * Get a new logger, or root loggger if no name is provided
 * @param {string} [name]
 * @returns {Logger}
 */
function getLogger (name) {
  if (!rootLogger) {
    throw new Error('Initalize boiler before using logger');
  }
  if (!name) {
    return rootLogger;
  }
  return rootLogger.getLogger(name);
}

module.exports = {
  getLogger,
  setGlobalName,
  initLoggerWithConfig
};
