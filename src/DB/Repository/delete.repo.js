export async function deleteOne(model, filter) {
    return await model.deleteOne(filter)
}