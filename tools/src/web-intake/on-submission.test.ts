import { describe, expect, it, vi } from 'vitest';
import type { BlobStore } from './uploads.ts';
import { handleSubmission, type SubmissionEvent } from './on-submission.ts';
import type { WebIntakePayload } from './payload.ts';

const store = {} as BlobStore;
const ev = (over: Partial<SubmissionEvent> = {}): SubmissionEvent => ({
  formName: 'budget-intake',
  submissionId: 'sub-1',
  data: { entity: 'su/x', fiscal_year: '2026', email: 'a@b.c', 'cf-turnstile-response': 'tok' },
  remoteIp: '1.2.3.4',
  ...over,
});

function deps(over: Record<string, unknown> = {}) {
  const dispatch = vi.fn(async (_p: WebIntakePayload) => {});
  const turnstileOk = vi.fn(async () => true);
  return { store, turnstileOk, dispatch, now: 1, ...over } as never as {
    store: BlobStore; turnstileOk: typeof turnstileOk; dispatch: typeof dispatch; now: number;
  };
}

describe('handleSubmission', () => {
  it('ignores other forms', async () => {
    const d = deps();
    expect(await handleSubmission(ev({ formName: 'contact' }), d)).toBe('ignored');
    expect(d.dispatch).not.toHaveBeenCalled();
    expect(d.turnstileOk).not.toHaveBeenCalled();
  });
  it('captcha failure does not dispatch', async () => {
    const d = deps({ turnstileOk: vi.fn(async () => false) });
    expect(await handleSubmission(ev(), d)).toBe('captcha-failed');
    expect(d.dispatch).not.toHaveBeenCalled();
  });
  it('passes token and ip to the captcha check', async () => {
    const d = deps();
    await handleSubmission(ev(), d);
    expect(d.turnstileOk).toHaveBeenCalledWith('tok', '1.2.3.4');
  });
  it('stale upload still dispatches', async () => {
    const d = deps();
    const s = { getJSON: async () => null } as unknown as BlobStore;
    const out = await handleSubmission(ev({ data: { ...ev().data, upload_id: 'gone' } }), { ...d, store: s });
    expect(out).toBe('dispatched');
    expect(d.dispatch).toHaveBeenCalledOnce();
  });
  it('dispatched payload has no email', async () => {
    const d = deps();
    await handleSubmission(ev(), d);
    const p = d.dispatch.mock.calls[0]![0];
    expect(p.submission_id).toBe('sub-1');
    expect(JSON.stringify(p)).not.toContain('a@b.c');
  });
  it('propagates dispatch errors', async () => {
    const d = deps({ dispatch: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(handleSubmission(ev(), d)).rejects.toThrow('boom');
  });
});
