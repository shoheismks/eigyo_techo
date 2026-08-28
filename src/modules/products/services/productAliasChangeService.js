export async function replaceProductAlias({
  originalAlias,
  nextAlias,
  addProductAlias,
  deactivateProductAlias,
}) {
  const stagedAlias = await addProductAlias({ ...nextAlias, isActive: false });

  try {
    await deactivateProductAlias(originalAlias.id);
    return await addProductAlias({
      ...stagedAlias,
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const rollbackErrors = [];
    await addProductAlias({
      ...originalAlias,
      isActive: true,
      updatedAt: new Date().toISOString(),
    }).catch((rollbackError) => rollbackErrors.push(rollbackError));
    await deactivateProductAlias(stagedAlias.id)
      .catch((rollbackError) => rollbackErrors.push(rollbackError));

    if (rollbackErrors.length) {
      const rollbackError = new Error('商品表記の変更に失敗し、元の状態を完全には確認できませんでした。再読み込みして状態を確認してください。');
      rollbackError.cause = error;
      rollbackError.rollbackErrors = rollbackErrors;
      throw rollbackError;
    }
    throw error;
  }
}
