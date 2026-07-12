package com.treyi.suitabilitygate.suitability.rules;

/**
 * Small text helpers shared by rules to keep their plain-English consistent.
 *
 * <p>Package-private, internal to the rules package — not part of any module API.
 */
final class RuleText {

    private RuleText() {
    }

    /**
     * Render an enum constant as a human label, e.g. {@code VERY_HIGH} → "Very High",
     * {@code CONSERVATIVE} → "Conservative". Used in rule {@code plainEnglish} sentences.
     *
     * @param value the enum constant
     * @return title-cased, space-separated label
     */
    static String humanize(Enum<?> value) {
        String[] words = value.name().toLowerCase().split("_");
        StringBuilder label = new StringBuilder();
        for (String word : words) {
            if (!label.isEmpty()) {
                label.append(' ');
            }
            label.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return label.toString();
    }
}
