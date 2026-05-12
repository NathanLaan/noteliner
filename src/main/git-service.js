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

  async pullRebase(folderPath) {
    try {
      return await this.exec(['pull', '--rebase'], folderPath);
    } catch (err) {
      this.log(`Pull --rebase failed: ${err.message}`);
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

  async getRemoteUrl(folderPath) {
    try {
      return await this.exec(['remote', 'get-url', 'origin'], folderPath);
    } catch {
      return null;
    }
  }

  async setRemoteUrl(folderPath, url) {
    const hasOrigin = await this.hasRemote(folderPath);
    if (hasOrigin) {
      return await this.exec(['remote', 'set-url', 'origin', url], folderPath);
    } else {
      return await this.exec(['remote', 'add', 'origin', url], folderPath);
    }
  }

  async removeRemote(folderPath) {
    return await this.exec(['remote', 'remove', 'origin'], folderPath);
  }

  async getSyncStatus(folderPath) {
    try {
      // Fetch to update remote refs
      await this.exec(['fetch', 'origin'], folderPath);
    } catch (err) {
      return { status: 'error', message: `Fetch failed: ${err.message}` };
    }

    try {
      const local = await this.exec(['rev-parse', 'HEAD'], folderPath);
      let remote;
      try {
        remote = await this.exec(['rev-parse', '@{u}'], folderPath);
      } catch {
        return { status: 'no-upstream' };
      }

      if (local === remote) {
        return { status: 'synced' };
      }

      const base = await this.exec(['merge-base', 'HEAD', '@{u}'], folderPath);

      if (base === remote) {
        const count = await this.exec(['rev-list', '--count', '@{u}..HEAD'], folderPath);
        return { status: 'ahead', count: parseInt(count, 10) };
      }

      if (base === local) {
        const count = await this.exec(['rev-list', '--count', 'HEAD..@{u}'], folderPath);
        return { status: 'behind', count: parseInt(count, 10) };
      }

      const ahead = await this.exec(['rev-list', '--count', '@{u}..HEAD'], folderPath);
      const behind = await this.exec(['rev-list', '--count', 'HEAD..@{u}'], folderPath);
      return { status: 'diverged', ahead: parseInt(ahead, 10), behind: parseInt(behind, 10) };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }

  async getCurrentBranch(folderPath) {
    try {
      return await this.exec(['branch', '--show-current'], folderPath);
    } catch {
      return null;
    }
  }

  async setUpstreamAndPush(folderPath, branch) {
    return await this.exec(['push', '-u', 'origin', branch], folderPath);
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

  async resetToRemote(folderPath, branch) {
    await this.exec(['fetch', 'origin'], folderPath);
    return await this.exec(['reset', '--hard', `origin/${branch}`], folderPath);
  }

  async getFileLog(folderPath, filename) {
    try {
      const raw = await this.exec([
        'log', '--follow',
        '--pretty=format:%H|%ai|%an|%s',
        '--', filename
      ], folderPath);
      if (!raw) return [];
      return raw.split('\n').filter(Boolean).map(line => {
        const [hash, date, author, ...msgParts] = line.split('|');
        return { hash, date, author, message: msgParts.join('|') };
      });
    } catch {
      return [];
    }
  }

  async getFileAtCommit(folderPath, commit, filename) {
    try {
      return await this.exec(['show', `${commit}:${filename}`], folderPath);
    } catch {
      return null;
    }
  }

  async flushPush(folderPath) {
    if (this.pushTimer) {
      clearTimeout(this.pushTimer);
      this.pushTimer = null;
    }
    const hasRemote = await this.hasRemote(folderPath);
    if (hasRemote) {
      await this.push(folderPath);
    }
  }
}

module.exports = { GitService };
