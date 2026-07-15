import fs from 'node:fs/promises';
import path from 'node:path';

interface GenerateDockerfileOptions {
    framework: string;
    projectPath: string;
    buildCommand?: string;
    startCommand?: string;
    rootDir?: string;
    baseImage?: string;
    runCommand?: string;
    copyCommand?: string;
    exposeCommand?: string;
}

export const generateDockerfile = async ({
    framework,
    projectPath,
    buildCommand,
    startCommand,
    rootDir,
    baseImage,
    runCommand,
    copyCommand,
    exposeCommand,
}: GenerateDockerfileOptions) => {
    const templatePath = path.join(__dirname, '../templates', framework, 'Dockerfile');
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    let templateContent = await fs.readFile(templatePath, 'utf8');

    const copyParts = (copyCommand || '. .').trim().split(/\s+/).filter(Boolean);
    const copySource = copyParts[0] || '.';
    const copyDestination = copyParts[1] || '.';
    const exposePort = exposeCommand || '3000';
    const resolvedRunCommand =
        framework === 'custom' ? runCommand || 'true' : runCommand || buildCommand || 'npm install';

    const replacements: Record<string, string> = {
        rootDir: rootDir || '',
        buildCommand: buildCommand || '',
        startCommand: startCommand || '',
        baseImage: baseImage || 'node:18-alpine',
        runCommand: resolvedRunCommand,
        copySource,
        copyDestination,
        exposePort,
    };

    templateContent = templateContent.replace('ARG COPY_SOURCE=.', `ARG COPY_SOURCE=${copySource}`);
    templateContent = templateContent.replace(
        'ARG COPY_DESTINATION=.',
        `ARG COPY_DESTINATION=${copyDestination}`
    );
    templateContent = templateContent.replace('ARG EXPOSE_PORT=3000', `ARG EXPOSE_PORT=${exposePort}`);

    for (const [placeholder, value] of Object.entries(replacements)) {
        templateContent = templateContent.replace(
            new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g'),
            value
        );
    }

    await fs.writeFile(dockerfilePath, templateContent);
};
