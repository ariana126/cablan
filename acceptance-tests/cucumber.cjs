const base = {
    require: [
        'support/**/*.ts',
        'step-definitions/**/*.steps.ts',
    ],
    requireModule: ['ts-node/register'],
    format: ['@serenity-js/cucumber'],
    // Tolerate steps that deliberately `return 'pending'` — scenarios the business has
    // agreed but nobody has automated yet. They still run, and still reach the living
    // documentation as Pending. Nothing else is loosened: an undefined, ambiguous or
    // failing step fails the run whatever this is set to, so a forgotten or renamed
    // step definition still breaks the build.
    strict: false,
};

module.exports = {
    // Every feature. Cucumber *adds* CLI paths to a profile's `paths` rather than replacing
    // them, so a path given on the command line under this profile still runs the whole suite.
    default: { ...base, paths: ['specs/**/*.feature'] },
    // The same configuration with no `paths`, so the CLI's own paths are the only ones run:
    // `npx cucumber-js -p selected specs/….feature[:line]`. Naming a profile replaces `default`
    // rather than merging with it, which is what makes this work.
    selected: base,
};
