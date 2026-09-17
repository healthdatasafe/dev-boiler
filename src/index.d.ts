/**
 * @license
 * [BSD-3-Clause](https://github.com/pryv/pryv-boiler/blob/master/LICENSE)
 */

// ----- Exported Types (for ESM: import type { Config, Logger } from 'dev-boiler') -----

export interface InitOptions {
  /** The name of the application, used by Logger and debug */
  appName: string;
  /** Directory to use to look for configs (default, env) */
  baseConfigDir?: string;
  /** Directory to use for `file://` relative paths */
  baseFilesDir?: string;
  /** Array of extra config sources to load */
  extraConfigs?: Array<ConfigFile | ConfigPlugin | ConfigPluginAsync | ConfigData | ConfigRemoteURL | ConfigRemoteURLFromKey | ConfigFileAsync>;
}

export interface ConfigFile {
  /** Scope for nconf hierarchical load */
  scope: string;
  /** The config file path (.yml, .json, .js) */
  file: string;
}

export interface ConfigFileAsync {
  /** Scope for nconf hierarchical load */
  scope: string;
  /** The async config file path (.js that exports an async function) */
  fileAsync: string;
}

export interface ConfigPlugin {
  plugin: {
    /** Function that takes the Config instance and returns the plugin name */
    load: (config: Config) => string;
  };
}

export interface ConfigPluginAsync {
  pluginAsync: {
    /** Async function that takes the Config instance and returns the plugin name */
    load: (config: Config) => Promise<string>;
  };
}

export interface ConfigData {
  /** Scope for nconf hierarchical load */
  scope: string;
  /** Key to load data under. If null, loaded at root of the config */
  key?: string;
  /** The data to load */
  data: object;
}

export interface ConfigRemoteURL {
  /** Scope for nconf hierarchical load */
  scope: string;
  /** Key to load result of URL under. If null, loaded at root of the config */
  key?: string;
  /** The URL to the config definition */
  url: string;
}

export interface ConfigRemoteURLFromKey {
  /** Scope for nconf hierarchical load */
  scope: string;
  /** Key to load result of URL under. If null, override */
  key?: string;
  /** Retrieve URL from config matching this key */
  urlFromKey: string;
}

export interface ScopeAndValue {
  value: unknown;
  scope: string;
  info: string;
}

/** Type alias for extra config entries */
export type ExtraConfig = ConfigFile | ConfigPlugin | ConfigPluginAsync | ConfigData | ConfigRemoteURL | ConfigRemoteURLFromKey | ConfigFileAsync;

export interface Config {
  /** The nconf store instance */
  store: unknown;
  /** The logger instance for config */
  logger: Logger;
  /** Base directory for config files */
  baseConfigDir: string;

  /**
   * Return true if key has a value
   * @param key - The config key to check
   */
  has(key: string): boolean;

  /**
   * Retrieve value
   * @param key - The config key. If no key is provided, all the config is returned
   */
  get(key?: string): unknown;
  get<T>(key: string): T;

  /**
   * Retrieve value and store info that applies
   * @param key - The config key
   */
  getScopeAndValue(key: string): ScopeAndValue | null;

  /**
   * Set value
   * @param key - The config key
   * @param value - The value to set
   */
  set(key: string, value: unknown): void;

  /**
   * Inject test config and override any other option
   * @param configObject - The config object to inject for testing
   */
  injectTestConfig(configObject: object): void;

  /**
   * Replace a scope config set
   * @param scope - The scope to replace
   * @param configObject - The new config object for the scope
   */
  replaceScopeConfig(scope: string, configObject: object): void;
}

export interface Logger {
  /** The name of this logger */
  name: string;
  /** The parent logger, if any */
  parent: Logger | null;

  /**
   * Log a message at the specified level
   * @param level - The log level
   * @param message - The log message
   * @param context - Additional context
   */
  log(level: string, message: string, ...context: unknown[]): void;

  /**
   * Log an info message
   * @param message - The log message
   * @param context - Additional context
   */
  info(message: string, ...context: unknown[]): void;

  /**
   * Log a warning message
   * @param message - The log message
   * @param context - Additional context
   */
  warn(message: string, ...context: unknown[]): void;

  /**
   * Log an error message
   * @param message - The log message
   * @param context - Additional context
   */
  error(message: string, ...context: unknown[]): void;

  /**
   * Log a debug message
   * @param message - The log message
   * @param context - Additional context
   */
  debug(message: string, ...context: unknown[]): void;

  /**
   * Get a "sub" Logger
   * @param name - The name of the child logger
   */
  getLogger(name: string): Logger;

  /**
   * Dump objects with file and line for debugging
   */
  inspect(...args: unknown[]): void;
}

/** The Boiler instance type (returned by init()) */
export interface Boiler {
  /**
   * Get a Logger
   * @param name - The name of the logger
   */
  getLogger: (name?: string) => Logger;

  /**
   * Preferred way to get the configuration.
   * Waits until the configuration is fully initialized.
   */
  getConfig: () => Promise<Config>;

  /**
   * Get the configuration.
   * If the configuration is not fully initialized, throws an error (or warns if warnOnly is true).
   * @param warnOnly - Only warns about potential misuse of config instead of throwing
   */
  getConfigUnsafe: (warnOnly?: boolean) => Config;

  /**
   * Initialize Boiler. Should be called just once when starting an app.
   * @param options - Initialization options
   * @param fullyLoadedCallback - Called when the config is fully loaded
   */
  init: (options: InitOptions, fullyLoadedCallback?: (config: Config) => void) => Boiler;
}

// ----- Module-level functions (for: const { getConfig, getLogger } = boiler) -----

export function getLogger(name?: string): Logger;
export function getConfig(): Promise<Config>;
export function getConfigUnsafe(warnOnly?: boolean): Config;
export function init(options: InitOptions, fullyLoadedCallback?: (config: Config) => void): Boiler;

// ----- Default Export (for: import boiler from 'dev-boiler') -----

declare const boiler: Boiler;
export default boiler;
