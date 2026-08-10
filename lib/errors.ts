type ErrorLike = {
  message?: unknown;
};

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const message = (error as ErrorLike).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

export function toError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(getErrorMessage(error, fallback), { cause: error });
}

export class PartialUploadError<Result> extends Error {
  readonly completed: Result[];

  constructor(message: string, completed: Result[], cause: unknown) {
    super(message, { cause });
    this.name = "PartialUploadError";
    this.completed = completed;
  }
}
