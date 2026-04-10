const { execFile } = require('child_process');

class GitService {
  constructor(logCallback) {
    this.log = logCallback || (() => {});
    this.pushTimer = null;
    this.pushDebounceMs = 30000;
  }

  exec(args, cwd) {
    return new Promise((resolve, reject) => {
      const cmdStr = `git ${args.join(' ')}`;
      this.log(`> ${cmdStr}`);

      execFile('git', args, { cwd, timeout: 60000 }, (error, stdout, stderr) => {
        if (stdout.trim()) this.log(stdout.trim());
        if (stderr.trim()) this.log(stderr.trim());

        if (error) {
          this.log(`Error: ${error.message}`);
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async isGitRepo(folderPath) {
    try {
      await this.exec(['rev-parse', '--is-inside-work-tree'], folderPath);
      return true;
    } catch {
      return false;
    }
  }

  async init(folderPath) {
    return await this.exec(['init'], folderPath);
  }

  async clone(remoteUrl, folderPath) {
    return await this.exec(['clone', remoteUrl, '.'], folderPath);
  }

  async addAll(folderPath) {
    return await this.exec(['add', '-A'], folderPath);
  }

  async commit(folderPath, message) {
    await this.addAll(folderPath);
    try {
      return await this.exec(['commit', '-m', message], folderPath);
    } catch (err) {
      if (err.message && err.message.includes('nothing to commit')) {
        this.log('Nothing to commit.');
        return null;
      }
      if (err.message && (err.message.includes('unable to auto-detect email') || err.message.includes('user.name') || err.message.includes('user.email'))) {
        const configErr = new Error('git_config_required');
        configErr.code = 'GIT_CONFIG_REQUIRED';
        throw configErr;
      }
      throw err;
    }
  }

  async push(folderPath) {
    try {
      return await this.exec(['push'], folderPath);
    } catch (err) {
      this.log(`Push failed: ${err.message}`);
      return null;
    }
  }

  async pull(folderPath) {
    try {
      return await this.exec(['pull'], folderPath);
    } catch (err) {
      this.log(`Pull failed: ${err.message}`);
      return null;
    }
  }

  async addRemote(folderPath, url) {
    return await this.exec(['remote', 'add', 'origin', url], folderPath);
  }

  async getConfig(folderPath, key) {
    // Try local first, then fall back to global
    try {
      return await this.exec(['config', '--local', key], folderPath);
    } catch {
      try {
        return await this.exec(['config', key], folderPath);
      } catch {
        return null;
      }
    }
  }

  async setConfig(folderPath, key, value) {
    return await this.exec(['config', '--local', key, value], folderPath);
  }

  async checkConfig(folderPath) {
    const name = await this.getConfig(folderPath, 'user.name');
    const email = await this.getConfig(folderPath, 'user.email');
    return { name, email };
  }

  async hasRemote(folderPath) {
    try {
      const result = await this.exec(['remote'], folderPath);
      return result.length > 0;
    } catch {
      return false;
    }
  }

  schedulePush(folderPath) {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
    }
    this.pushTimer = setTimeout(async () => {
      this.pushTimer = null;
      const hasRemote = await this.hasRemote(folderPath);
      if (hasRemote) {
        await this.push(folderPath);
      }
    }, this.pushDebounceMs);
  }
}

module.exports = { GitService };
