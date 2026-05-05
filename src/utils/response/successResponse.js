function successResponse({ res, data, message = 'success', statusCode = 200 }) {
    return res.status(statusCode).json({
        success: true,
        message,
        data
    })
}

export default successResponse