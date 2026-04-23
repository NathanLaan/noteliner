const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100MB — reject up front
const MAX_ATTACHMENT_SIZE = 30 * 1024 * 1024;

const CONTENT_TYPE_EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
};

// Word uses "Heading 1".."Heading 9"; we only support H1-H6 in markdown.
const STYLE_MAP = [
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
];

class ImportService {
  constructor(projectService) {
    this.projectService = projectService;
  }

  async importDocx(sourcePath) {
    if (!this.projectService.projectPath) {
      throw new Error('No project is open');
    }
    if (!sourcePath || !path.isAbsolute(sourcePath)) {
      throw new Error('Invalid source path');
    }
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file does not exist');
    }

    const stat = fs.statSync(sourcePath);
    if (stat.size > MAX_DOC_SIZE) {
      throw new Error(`Document exceeds ${MAX_DOC_SIZE / 1024 / 1024}MB limit`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const sourceName = path.basename(sourcePath, path.extname(sourcePath));

    // Create the note first so we have a fileId to attach images to.
    // Start body empty so we can overwrite with the converted content.
    const entry = await this.projectService.createFile(sourceName, [], { body: '' });

    const stats = { images: 0, tablesStripped: 0, warnings: [] };

    let result;
    try {
      result = await mammoth.convertToMarkdown(
        {
          buffer,
          transformDocument: (doc) => this.stripTables(doc, stats),
          convertImage: mammoth.images.imgElement(async (image) => {
            return await this.handleImage(image, entry.id, stats);
          }),
        },
        { styleMap: STYLE_MAP }
      );
    } catch (err) {
      // If conversion fails after we created the note, leave it in place with an
      // empty body — safer than trying to delete (which would add another commit)
      // and lets the user see what landed before asking to retry.
      throw new Error(`Conversion failed: ${err.message}`);
    }

    for (const msg of result.messages || []) {
      if (msg.type === 'warning' || msg.type === 'error') {
        stats.warnings.push(msg.message);
      }
    }

    const markdown = this.postProcess(result.value, sourceName);
    await this.projectService.writeFile(entry.filename, markdown);

    return { entry, stats };
  }

  stripTables(doc, stats) {
    const walk = (node) => {
      if (!node || !node.children) return node;
      const kept = [];
      for (const child of node.children) {
        if (child.type === 'table') {
          stats.tablesStripped += 1;
          // Replace with a paragraph placeholder so context isn't lost.
          kept.push({
            type: 'paragraph',
            styleId: null,
            styleName: null,
            numbering: null,
            alignment: null,
            children: [{ type: 'text', value: '[Table omitted during import]' }],
          });
          continue;
        }
        kept.push(walk(child));
      }
      node.children = kept;
      return node;
    };
    return walk(doc);
  }

  async handleImage(image, fileId, stats) {
    stats.images += 1;
    const contentType = (image.contentType || '').toLowerCase();

    // Skip Windows-only vector formats that markdown/browser preview can't render.
    if (contentType === 'image/x-emf' || contentType === 'image/x-wmf' ||
        contentType === 'image/emf' || contentType === 'image/wmf') {
      stats.warnings.push(`Unsupported image format skipped: ${contentType}`);
      return { src: '' };
    }

    const ext = CONTENT_TYPE_EXT[contentType] || '.bin';
    if (ext === '.bin') {
      stats.warnings.push(`Unknown image content type: ${contentType || '(none)'}`);
    }

    let buffer;
    try {
      buffer = await image.read();
    } catch (err) {
      stats.warnings.push(`Failed to read embedded image: ${err.message}`);
      return { src: '' };
    }

    if (!buffer || buffer.length === 0) {
      stats.warnings.push('Empty image skipped');
      return { src: '' };
    }
    if (buffer.length > MAX_ATTACHMENT_SIZE) {
      stats.warnings.push(`Image exceeded 30MB limit, skipped`);
      return { src: '' };
    }

    const originalName = `image-${Date.now().toString(36)}-${stats.images}${ext}`;
    try {
      const attachment = await this.projectService.addAttachment(fileId, buffer, originalName);
      return {
        src: `./_attachments/${attachment.filename}`,
        alt: image.altText || '',
      };
    } catch (err) {
      stats.warnings.push(`Failed to attach image: ${err.message}`);
      return { src: '' };
    }
  }

  postProcess(markdown, sourceName) {
    let md = markdown || '';

    // Mammoth may emit images whose src we set to '' (skipped). Remove those.
    md = md.replace(/!\[[^\]]*\]\(\s*\)\n?/g, '');

    // Collapse runs of 3+ blank lines to 2.
    md = md.replace(/\n{3,}/g, '\n\n');

    // Trim trailing whitespace on each line.
    md = md.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n');

    // Ensure the doc starts with an H1 derived from the source filename if
    // mammoth didn't emit one.
    if (!/^#\s/m.test(md.split('\n').slice(0, 5).join('\n'))) {
      md = `# ${sourceName}\n\n${md.replace(/^\n+/, '')}`;
    }

    // Trim leading/trailing blank lines.
    md = md.replace(/^\n+/, '').replace(/\n+$/, '\n');

    return md;
  }
}

module.exports = { ImportService };
