package com.openu60.core.model

data class BandConfig(
    val nrBands: List<Int> = emptyList(),
    val lteBands: List<Int> = emptyList(),
    val locked: Boolean = false,
) {
    companion object {
        // Sync with zte-script-ng.js and common ZTE bands
        val COMMON_NR_BANDS = listOf(1, 2, 3, 5, 7, 8, 18, 20, 26, 28, 29, 38, 40, 41, 48, 66, 71, 75, 77, 78, 79)
        val COMMON_LTE_BANDS = listOf(1, 2, 3, 4, 5, 7, 8, 12, 13, 14, 17, 18, 19, 20, 25, 26, 28, 29, 30, 32, 34, 38, 39, 40, 41, 42, 43, 48, 66, 71)
    }
}
