import { request } from '../core/rpc.js';
import { validateSettings } from '../core/settings.js';
import { evaluate, renderGreeting } from '../core/rules.js';
import * as site from './site.js';

const active = status => ['running', 'paused', 'navigating'].includes(status);
const expired = task => !task || Date.now() - task.updatedAt > 30 * 60 * 1000;

export class Runner {
  constructor(panel) {
    this.panel = panel;
    this.task = { status: 'idle', applied: 0, checked: 0 };
    this.busy = false;
  }

  snapshot() { return { status: this.task.status, applied: this.task.applied, checked: this.task.checked }; }

  async persist() {
    this.task.updatedAt = Date.now();
    await request('task.write', this.task);
    this.panel.update(this.snapshot());
  }

  checkpoint() {
    if (this.controller?.signal.aborted || !active(this.task.status)) throw new DOMException('任务已停止', 'AbortError');
  }

  async delay(milliseconds) {
    let elapsed = 0;
    while (elapsed < milliseconds || this.task.status === 'paused') {
      this.checkpoint();
      await new Promise(resolve => setTimeout(resolve, 100));
      if (this.task.status !== 'paused') elapsed += 100;
    }
    this.checkpoint();
  }

  async until(read, timeout = 7000) {
    let elapsed = 0;
    while (elapsed < timeout) {
      await this.delay(100);
      const result = read();
      if (result) return result;
      elapsed += 100;
    }
    return null;
  }

  async start() {
    if (this.busy || active(this.task.status)) throw new Error('已有投递任务在运行。');
    if (site.route() !== 'list') throw new Error('请先进入 BOSS 直聘职位列表。');
    const settings = await request('settings.get');
    const error = validateSettings(settings);
    if (error) throw new Error(error);
    this.task = {
      id: crypto.randomUUID(), source: location.href, settings,
      processed: [], applied: 0, checked: 0, status: 'running', pending: null
    };
    await this.persist();
    void this.execute();
    return this.snapshot();
  }

  async restore() {
    if (this.busy) return;
    const saved = await request('task.read');
    if (expired(saved) || !active(saved.status)) return;
    this.task = saved;
    this.panel.update(this.snapshot());
    if (saved.status !== 'paused') void this.execute();
  }

  async pause() {
    if (this.task.status === 'paused') {
      this.task.status = 'running';
      await this.persist();
      if (!this.busy) void this.execute();
    } else if (this.task.status === 'running') {
      this.task.status = 'paused';
      await this.persist();
    }
    return this.snapshot();
  }

  async stop() {
    this.controller?.abort();
    this.task.status = 'stopped';
    this.task.pending = null;
    await this.persist();
    this.panel.log('任务已停止。');
    return this.snapshot();
  }

  async execute() {
    if (this.busy) return;
    this.busy = true;
    this.controller = new AbortController();
    try {
      this.task.status = 'running';
      await this.persist();
      if (site.route() === 'chat') await this.greet();
      else if (site.route() === 'detail') {
        if (!this.task.pending) throw new Error('职位详情缺少任务上下文，请返回职位列表。');
        const navigating = await this.apply(this.task.pending.job);
        if (!navigating) this.returnToList();
      } else if (site.route() === 'list') {
        if (this.task.pending?.phase === 'greeting') {
          this.panel.log('聊天流程未完成，请检查聊天页；本轮已暂停。', 'error');
          throw new Error('招呼语尚未确认，不能自动继续。');
        }
        await this.scan();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        this.task.status = 'error';
        this.panel.log(error.message, 'error');
        await this.persist();
      }
    } finally {
      this.busy = false;
      this.panel.update(this.snapshot());
    }
  }

  async scan() {
    const records = await request('records.list');
    const appliedIds = new Set(records.map(row => String(row.id)));
    let emptyRounds = 0;
    this.panel.log('开始检查当前列表，详情确认后再决定是否沟通。');
    while (this.task.applied < this.task.settings.maxJobs && emptyRounds < 3) {
      await this.delay(200);
      const jobs = site.scan().filter(job => !this.task.processed.includes(job.id));
      if (!jobs.length) {
        emptyRounds++;
        site.loadMore();
        await this.delay(1200);
        continue;
      }
      emptyRounds = 0;
      for (const job of jobs) {
        await this.delay(100);
        if (this.task.applied >= this.task.settings.maxJobs) break;
        this.task.processed.push(job.id);
        this.task.checked++;
        if (appliedIds.has(job.id)) { this.panel.log(`已记录，略过：${job.title}`); continue; }
        const match = evaluate(job, this.task.settings, { partial: true });
        if (!match.accepted) { this.panel.log(`${job.title} · ${match.reason}`); continue; }
        this.task.pending = { job: site.serializable(job), phase: 'detail' };
        await this.persist();
        this.checkpoint();
        site.openDetail(job);
        const detail = await this.until(() => site.readDetail(job));
        if (!detail) throw new Error(`无法确认「${job.title}」详情，已停止本轮，请刷新职位页。`);
        const navigating = await this.apply(detail);
        if (navigating) return;
        await this.delay(this.task.settings.delay);
      }
    }
    this.task.status = 'completed';
    this.task.pending = null;
    await this.persist();
    this.panel.log(`本轮结束，确认沟通 ${this.task.applied} 个职位。`, 'success');
  }

  async record(job, score) {
    if (this.task.pending.recorded) return;
    await request('records.add', { ...site.serializable(job), matchScore: score });
    this.checkpoint();
    this.task.pending.recorded = true;
    this.task.applied++;
    await this.persist();
    this.panel.log(`已确认沟通：${job.title}`, 'success');
  }

  async apply(job) {
    const detail = site.readDetail(job) || job;
    const match = evaluate(detail, this.task.settings);
    if (!match.accepted) {
      this.panel.log(`${job.title} · ${match.reason}`);
      this.task.pending = null;
      await this.persist();
      return false;
    }
    const button = site.communicationButton(detail);
    if (!button) {
      this.panel.log(`${job.title} · 没有可用的“立即沟通”按钮，略过。`);
      this.task.pending = null;
      await this.persist();
      return false;
    }
    this.task.pending = { ...this.task.pending, job: detail, phase: 'communicate', score: match.score };
    await this.persist();
    await this.delay(300);
    button.click();
    const result = await this.until(() => site.communicationState(detail));
    if (!result) throw new Error('点击后未收到沟通成功反馈。请检查登录、平台提示和沟通额度。');
    if (result.dialog) {
      this.task.pending.phase = 'greeting';
      this.task.pending.message = renderGreeting(this.task.settings.greetingTemplate, detail);
      this.task.status = 'navigating';
      await this.persist();
      if (result.dialog && !site.continueChat(result.dialog)) throw new Error('无法进入聊天页。');
      return true;
    }
    if (result === 'chat') {
      this.task.pending.phase = 'greeting';
      this.task.pending.message = renderGreeting(this.task.settings.greetingTemplate, detail);
      this.task.status = 'navigating';
      await this.persist();
      return true;
    }
    await this.record(detail, match.score);
    this.task.pending = null;
    await this.persist();
    return false;
  }

  async greet() {
    const pending = this.task.pending;
    if (!pending) throw new Error('没有与当前聊天匹配的投递任务。');
    const matched = await this.until(() => site.conversationMatches(pending.job));
    if (!matched) throw new Error('无法确认聊天对象对应当前职位，请在页面中手动检查。');
    await this.record(pending.job, pending.score || 70);
    if (!this.task.settings.autoGreeting) {
      this.task.pending = null;
      await this.persist();
      this.returnToList();
      return;
    }
    const message = pending.message || renderGreeting(this.task.settings.greetingTemplate, pending.job);
    if (!site.hasGreeting(message)) {
      // A reload after a send attempt must not send the same greeting again.
      if (pending.sendAttempted) throw new Error('上次发送结果未确认，请手动核对聊天记录。');
      const editor = await this.until(() => site.greetingEditor());
      if (!editor) throw new Error('聊天输入框未找到，请手动发送招呼语。');
      const draft = 'value' in editor ? editor.value : editor.textContent;
      if (draft.trim() && draft.trim() !== message) throw new Error('聊天输入框中已有草稿，请先手动处理。');
      site.writeGreeting(editor, message);
      await this.delay(300);
      pending.sendAttempted = true;
      await this.persist();
      this.checkpoint();
      if (!site.sendGreeting(editor)) throw new Error('发送按钮不可用，请手动发送招呼语。');
      if (!await this.until(() => site.hasGreeting(message))) throw new Error('未确认招呼语发送结果，请检查聊天记录。');
    }
    this.panel.log('自定义招呼语已确认。', 'success');
    this.task.pending = null;
    await this.persist();
    this.returnToList();
  }

  returnToList() {
    this.checkpoint();
    const source = new URL(this.task.source);
    if (source.origin !== location.origin || !source.pathname.startsWith('/web/geek/job')) throw new Error('职位列表地址无效。');
    location.assign(source.href);
  }
}
