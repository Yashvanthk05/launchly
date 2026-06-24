import fs from 'node:fs/promises';
import path from 'node:path';

export const generateDockerfile = async (
    framework: string,
    projectPath: string,
    buildCommand: string,
    startCommand: string,
    rootDir: string
) => {
    const templatePath = path.join(__dirname, '../templates', framework, 'Dockerfile');
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    let templateContent = await fs.readFile(templatePath, 'utf8');
    if (rootDir) {
        templateContent = templateContent.replace('{{rootDir}}', rootDir);
    }
    if (buildCommand) {
        templateContent = templateContent.replace('{{buildCommand}}', buildCommand);
    }
    if (startCommand) {
        templateContent = templateContent.replace('{{startCommand}}', startCommand);
    }
    await fs.writeFile(dockerfilePath, templateContent);
};
