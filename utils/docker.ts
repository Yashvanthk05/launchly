import fs from 'node:fs/promises';
import path from 'node:path';

export const writeDockerfile = async (projectPath: string, content: string) => {
    const dockerfilePath = path.join(projectPath, 'Dockerfile');
    await fs.writeFile(dockerfilePath, content.trimEnd() + '\n');
};
