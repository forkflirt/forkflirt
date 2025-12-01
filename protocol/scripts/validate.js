const Ajv = require("ajv");
const addFormats = require("ajv-formats");
const fs = require("fs");
const path = require("path");

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// 1. Load the Schema
const schemaPath = path.join(__dirname, "../schemas/profile.schema.json");
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));

const validate = ajv.compile(schema);

// 2. Load the Example/Test Profile
// (You should create an 'examples/profile.json' to test against)
const examplePath =
  process.argv[2] || path.join(__dirname, "../examples/profile.json");

if (!fs.existsSync(examplePath)) {
  console.error(`❌ File not found: ${examplePath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(examplePath, "utf-8"));

// 3. Validate
const valid = validate(data);

if (valid) {
  console.log("✅ Profile JSON is valid!");
} else {
  console.error("❌ Validation failed:");
  console.error(validate.errors);
  process.exit(1);
}
