export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Bad request") {
    super(400, message);
  }
}

/** A new ScheduledShift's time range overlaps an existing scheduled shift for the same employee. */
export class ScheduleConflictError extends HttpError {
  constructor(employeeId: string) {
    super(409, `Employee ${employeeId} already has an overlapping scheduled shift`);
    this.name = "ScheduleConflictError";
  }
}

/** tlm-punch-processor (the internal engine service) returned an error or was unreachable. */
export class UpstreamServiceError extends HttpError {
  constructor(message: string) {
    super(502, message);
    this.name = "UpstreamServiceError";
  }
}
