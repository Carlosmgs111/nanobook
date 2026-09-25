type ResultState<E, T> =
  | { readonly isSuccess: true; readonly value: T }
  | { readonly isSuccess: false; readonly error: E };

export class Result<E, T> {
  private constructor(private readonly state: ResultState<E, T>) {}

  public get isSuccess(): boolean {
    return this.state.isSuccess;
  }

  public static ok<T>(value: T): Result<never, T>;
  public static ok(): Result<never, void>;
  public static ok<T>(value?: T): Result<never, T | void> {
    return new Result<never, T | void>({
      isSuccess: true,
      value,
    });
  }

  public static fail<E>(error: E): Result<E, never> {
    return new Result<E, never>({
      isSuccess: false,
      error,
    });
  }

  public getValue(): T {
    if (!this.state.isSuccess) {
      throw new Error(
        "Invalid Operation: Can't get value from a failed result"
      );
    }
    return this.state.value;
  }

  public getError(): E {
    if (this.state.isSuccess) {
      throw new Error(
        "Invalid Operation: Can't get error from a success result"
      );
    }
    return this.state.error;
  }
}
