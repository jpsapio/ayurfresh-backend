export function successResponse(res, status=200, message = "Success", data = {}) {
 
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

export function errorResponse(res, status = 500, message = "Something went wrong") {
  return res.status(status).json({
    success: false,
   errors: message,
  });
}

export function validationErrorResponse(res, errors = []) {
  return res.status(422).json({
    success: false,
    message: "Validation failed",
    errors,
  });
}
