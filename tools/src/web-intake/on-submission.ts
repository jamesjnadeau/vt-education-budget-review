/** Logic for the Netlify Forms submission-created event. */
import { FORM_NAME } from './limits.ts';
import { toDispatchPayload, type WebIntakePayload } from './payload.ts';
import { markSubmitted, type BlobStore } from './uploads.ts';

export interface SubmissionEvent {
  formName: string;
  submissionId: string;
  data: Record<string, unknown>;
  remoteIp: string | null;
}

export interface SubmissionDeps {
  store: BlobStore;
  turnstileOk: (token: string | null, ip: string | null) => Promise<boolean>;
  dispatch: (p: WebIntakePayload) => Promise<void>;
  now: number;
}

/** Logs only the submission id; never form data (it holds the email). */
export async function handleSubmission(
  ev: SubmissionEvent,
  deps: SubmissionDeps,
): Promise<'ignored' | 'captcha-failed' | 'dispatched'> {
  if (ev.formName !== FORM_NAME) return 'ignored';

  const raw = ev.data['cf-turnstile-response'];
  const token = typeof raw === 'string' && raw !== '' ? raw : null;
  if (!(await deps.turnstileOk(token, ev.remoteIp))) {
    console.warn(`web-intake: captcha failed for submission ${ev.submissionId}`);
    return 'captcha-failed';
  }

  const payload = toDispatchPayload(ev.submissionId, ev.data);
  if (payload.upload_id) {
    try {
      const out = await markSubmitted(deps.store, payload.upload_id, deps.now);
      if (!out.ok) console.warn(`web-intake: upload not marked submitted for submission ${ev.submissionId}: ${out.status}`);
    } catch {
      console.warn(`web-intake: upload not marked submitted for submission ${ev.submissionId}: store error`);
    }
  }

  await deps.dispatch(payload);
  return 'dispatched';
}
