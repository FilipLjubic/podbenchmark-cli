export class FxRateError extends Error {
  readonly _tag = "FxRateError";

  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "FxRateError";
  }
}
