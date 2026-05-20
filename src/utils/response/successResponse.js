function successResponse({ res, data, message = 'success', statusCode = 200, payload }) {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        payload
    })
}

export default successResponse