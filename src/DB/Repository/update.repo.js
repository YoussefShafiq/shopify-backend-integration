export async function findByIdAndUpdate(model, id, update, options = {}) {
    return await model.findByIdAndUpdate(id, update, options)
}