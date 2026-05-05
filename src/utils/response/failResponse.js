import { NODE_ENV } from "../../../configs/app.config.js"

/**
 * Throw a not found exception
 * @param {string} message - The message to throw
 * @returns {void}
 */
export function notFoundException(message = 'resource not found') {
    throw new Error(message, { cause: { statusCode: 404 } })
}

/**
 * Throw a conflict exception
 * @param {string} message - The message to throw
 * @returns {void}
 */
export function conflictException(message = 'resource already exists') {
    throw new Error(message, { cause: { statusCode: 409 } })
}

/**
 * 
 * @param {string} message 
 * @returns {void}
 */
export function notAuthorizedException(message = 'you are not authorized to access this resource') {
    throw new Error(message, { cause: { statusCode: 403 } })
}

/**
 * Throw a bad request exception
 * @param {string} message - The message to throw
 * @returns {void}
 */
export function badRequestException(message = 'bad request') {
    throw new Error(message, { cause: { statusCode: 400 } })
}

/**
 * Throw an unhandled exception
 * @param {string} message - The message to throw
 * @returns {void}
 */
export function unhandledException(message = 'unhandled') {
    throw new Error(message, { cause: { statusCode: 500 } })
}

/**
 * Global error handling middleware
 * @param {Error} err - The error to handle
 * @param {Request} req - The request object
 * @param {Response} res - The response object
 * @param {NextFunction} next - The next function
 * @returns {Response} The response object
 */
export function globalErrorHandling(err, req, res, next) {
    return NODE_ENV == 'dev' ?
        res.status(err.cause?.statusCode || 500).json({
            success: false,
            message: err.name === 'SequelizeUniqueConstraintError' ? `${err.errors[0]?.path || 'field'} '${err.errors[0]?.value || ''}' already exists` : err.message,
            stack: err.stack,
            err
        })
        :
        res.status(err.cause?.statusCode || 500).json({
            success: false,
            message: err.name === 'SequelizeUniqueConstraintError' ? `${err.errors[0]?.path || 'field'} '${err.errors[0]?.value || ''}' already exists` : err.message,
        })
}
