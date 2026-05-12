use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: PathBuf,
    pub tool_id: String,
    pub has_scripts: bool,
    pub has_references: bool,
}

#[derive(Debug, serde::Deserialize)]
struct Frontmatter {
    name: Option<String>,
    description: Option<String>,
}

/// Parse a SKILL.md file into a Skill struct.
pub fn parse_skill(skill_dir: &Path, tool_id: &str) -> Option<Skill> {
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.exists() {
        return None;
    }

    let content = std::fs::read_to_string(&skill_md).ok()?;
    let (frontmatter, _body) = extract_frontmatter(&content)?;

    // Try strict YAML parsing first, fall back to lenient line-by-line extraction
    let (name, description) = if let Ok(fm) = serde_yaml::from_str::<Frontmatter>(&frontmatter) {
        (fm.name, fm.description)
    } else {
        parse_frontmatter_lenient(&frontmatter)
    };

    let name = name.unwrap_or_else(|| {
        skill_dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });

    Some(Skill {
        name,
        description: description.unwrap_or_default(),
        path: skill_dir.to_path_buf(),
        tool_id: tool_id.to_string(),
        has_scripts: skill_dir.join("scripts").exists(),
        has_references: skill_dir.join("references").exists(),
    })
}

/// Extract YAML frontmatter and body from markdown content.
fn extract_frontmatter(content: &str) -> Option<(String, String)> {
    let content = content.trim_start();
    if !content.starts_with("---") {
        return None;
    }
    let after_first = &content[3..];
    let end = after_first.find("---")?;
    let frontmatter = after_first[..end].trim().to_string();
    let body = after_first[end + 3..].trim().to_string();
    Some((frontmatter, body))
}

/// Lenient frontmatter parser that handles unquoted colons in values.
fn parse_frontmatter_lenient(frontmatter: &str) -> (Option<String>, Option<String>) {
    let mut name = None;
    let mut description = None;

    for line in frontmatter.lines() {
        let trimmed = line.trim();
        if let Some(val) = trimmed.strip_prefix("name:") {
            name = Some(val.trim().trim_matches('"').to_string());
        } else if let Some(val) = trimmed.strip_prefix("description:") {
            description = Some(val.trim().trim_matches('"').to_string());
        }
    }

    (name, description)
}

/// Discover all skills in a directory.
pub fn discover_skills(skills_dir: &Path, tool_id: &str) -> Vec<Skill> {
    if !skills_dir.exists() {
        return Vec::new();
    }

    let mut skills = Vec::new();
    if let Ok(entries) = std::fs::read_dir(skills_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Some(skill) = parse_skill(&path, tool_id) {
                    skills.push(skill);
                }
            }
        }
    }
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_discover_skills_with_unquoted_colons() {
        // Test that frontmatter with unquoted colons in values is parsed correctly
        let fm = "name: test-skill\ndescription: Use when dark: something happens";
        let (name, desc) = parse_frontmatter_lenient(fm);
        assert_eq!(name.unwrap(), "test-skill");
        assert_eq!(desc.unwrap(), "Use when dark: something happens");
    }
}
