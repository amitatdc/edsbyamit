#!/usr/bin/env node
/* eslint-env node */

/**
 * Builds a FileVault content package with a sample page for the icon-list block,
 * so the block can be authored in the Universal Editor and previewed on Edge Delivery.
 *
 * Output: tools/packages/out/eba-icon-list.zip
 * Usage: npm run package:icon-list
 * Install: AEM Package Manager -> Upload -> Install, then publish /content/eba/examples/icon-list
 */

import {
  mkdirSync, writeFileSync, readFileSync, rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(scriptDir, '../..');
const OUT_DIR = join(ROOT, 'tools/packages/out');
const PKG_NAME = 'eba-icon-list';
const PKG_VERSION = '1.0';
const BUILD = join(OUT_DIR, `${PKG_NAME}-build`);
const ZIP = join(OUT_DIR, `${PKG_NAME}.zip`);
const SITE = '/content/eba';
const PAGE_PATH = 'examples/icon-list';
const PAGE_TITLE = 'Icon list';
const PAGE_DESCRIPTION = 'Sample page for the icon-list block and its author-facing icon picker.';
const NOW = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z');

const ITEM_FIELDS = '[icon@select,title@text,titleType@select,text@richtext,link@aem-content,linkText@text]';

const SECTIONS = [
  {
    heading: 'Default',
    classes: '',
    items: [
      {
        icon: 'check-circle',
        title: 'Pick an icon',
        text: 'The Icon field lists every SVG in the project icons folder, so authors never type a file name.',
        link: `${SITE}/${PAGE_PATH}`,
        linkText: 'Learn more',
      },
      {
        icon: 'download',
        title: 'Downloads',
        text: 'Point people at forms, reports and guidance documents.',
      },
      {
        icon: 'phone',
        title: 'Contact us',
        text: 'Talk to the team about an application already in progress.',
        link: `${SITE}/${PAGE_PATH}`,
        linkText: 'Call the team',
      },
    ],
  },
  {
    heading: 'Boxed',
    classes: 'boxed',
    items: [
      {
        icon: 'shield',
        title: 'Protected species',
        text: 'Check which species are protected before you start work.',
        link: `${SITE}/our-work/protecting-species`,
        linkText: 'Read the guidance',
      },
      {
        icon: 'calendar',
        title: 'Seasonal restrictions',
        text: 'Some activities are only permitted outside the breeding season.',
      },
      {
        icon: 'location',
        title: 'Find your region',
        text: 'Rules differ by region and district.',
      },
    ],
  },
  {
    heading: 'Compact',
    classes: 'compact',
    items: [
      { icon: 'clock', title: 'Ten minutes', text: 'Average time to complete the online form.' },
      { icon: 'mail', title: 'Email updates', text: 'Get notified when guidance changes.' },
      { icon: 'lock', title: 'Secure', text: 'Your details are only used to process the application.' },
      { icon: 'user', title: 'One account', text: 'Track every application from a single login.' },
    ],
  },
];

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Richtext values are HTML, so the markup itself has to survive XML escaping twice. */
function richtext(value) {
  return esc(`<p>${value}</p>`);
}

function write(path, contents) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function itemXml(item, index) {
  const optional = [
    item.link ? `\n                        link="${esc(item.link)}"` : '',
    item.linkText ? `\n                        linkText="${esc(item.linkText)}"` : '',
  ].join('');

  return `                    <item_${index}
                        jcr:primaryType="nt:unstructured"
                        sling:resourceType="core/franklin/components/block/v1/block/item"
                        model="icon-list-item"
                        modelFields="${ITEM_FIELDS}"
                        name="Icon List Item"
                        icon="${esc(item.icon)}"
                        title="${esc(item.title)}"
                        titleType="h3"
                        text="${richtext(item.text)}"${optional}/>`;
}

function sectionXml(section, index) {
  return `            <section_${index}
                jcr:primaryType="nt:unstructured"
                sling:resourceType="core/franklin/components/section/v1/section"
                modelFields="[name@text,style@multiselect]">
                <title
                    jcr:primaryType="nt:unstructured"
                    sling:resourceType="core/franklin/components/title/v1/title"
                    title="${esc(section.heading)}"
                    titleType="h2"/>
                <icon_list
                    jcr:primaryType="nt:unstructured"
                    sling:resourceType="core/franklin/components/block/v1/block"${section.classes ? `
                    classes="${esc(section.classes)}"` : ''}
                    filter="icon-list"
                    model="icon-list"
                    modelFields="[classes@multiselect]"
                    name="Icon List">
${section.items.map(itemXml).join('\n')}
                </icon_list>
            </section_${index}>`;
}

function pageXml() {
  const intro = 'Each item picks one icon from the SVG files in the project icons folder. '
    + 'Authors choose the icon from a dropdown, so the name always matches a file that exists.';

  return `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:nt="http://www.jcp.org/jcr/nt/1.0" xmlns:cq="http://www.day.com/jcr/cq/1.0" xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="cq:Page">
    <jcr:content
        cq:template="/libs/core/franklin/templates/page"
        jcr:primaryType="cq:PageContent"
        jcr:title="${esc(PAGE_TITLE)}"
        jcr:description="${esc(PAGE_DESCRIPTION)}"
        sling:resourceType="core/franklin/components/page/v1/page">
        <root
            jcr:primaryType="nt:unstructured"
            sling:resourceType="core/franklin/components/root/v1/root">
            <section
                jcr:primaryType="nt:unstructured"
                sling:resourceType="core/franklin/components/section/v1/section"
                modelFields="[name@text,style@multiselect]">
                <title
                    jcr:primaryType="nt:unstructured"
                    sling:resourceType="core/franklin/components/title/v1/title"
                    title="${esc(PAGE_TITLE)}"
                    titleType="h1"/>
                <text
                    jcr:primaryType="nt:unstructured"
                    sling:resourceType="core/franklin/components/text/v1/text"
                    text="${richtext(intro)}"/>
            </section>
${SECTIONS.map(sectionXml).join('\n')}
        </root>
    </jcr:content>
</jcr:root>
`;
}

function folderPageXml(title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<jcr:root xmlns:jcr="http://www.jcp.org/jcr/1.0" xmlns:cq="http://www.day.com/jcr/cq/1.0" xmlns:sling="http://sling.apache.org/jcr/sling/1.0"
    jcr:primaryType="cq:Page">
    <jcr:content
        cq:template="/libs/core/franklin/templates/page"
        jcr:primaryType="cq:PageContent"
        jcr:title="${esc(title)}"
        sling:resourceType="core/franklin/components/page/v1/page"/>
</jcr:root>
`;
}

rmSync(BUILD, { recursive: true, force: true });
mkdirSync(join(BUILD, 'META-INF/vault'), { recursive: true });

write(join(BUILD, 'META-INF/MANIFEST.MF'), `Manifest-Version: 1.0
Content-Package-Id: eba:${PKG_NAME}:${PKG_VERSION}
Content-Package-Roots: ${SITE}/examples
Content-Package-Type: content
`);

write(join(BUILD, 'META-INF/vault/properties.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE properties SYSTEM "http://java.sun.com/dtd/properties.dtd">
<properties>
<comment>FileVault Package Properties</comment>
<entry key="packageType">content</entry>
<entry key="group">eba</entry>
<entry key="name">${PKG_NAME}</entry>
<entry key="version">${PKG_VERSION}</entry>
<entry key="created">${NOW}</entry>
<entry key="createdBy">admin</entry>
<entry key="packageFormatVersion">2</entry>
<entry key="description">Sample page for the icon-list block</entry>
</properties>
`);

// merge on the parent so an existing /examples tree is left alone, replace only the sample page
write(join(BUILD, 'META-INF/vault/filter.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<workspaceFilter version="1.0">
    <filter root="${SITE}/examples" mode="merge"/>
    <filter root="${SITE}/${PAGE_PATH}" mode="replace"/>
</workspaceFilter>
`);

write(join(BUILD, 'META-INF/vault/config.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<vaultfs version="1.1"/>
`);

write(join(BUILD, `jcr_root${SITE}/examples/.content.xml`), folderPageXml('Examples'));
write(join(BUILD, `jcr_root${SITE}/${PAGE_PATH}/.content.xml`), pageXml());

mkdirSync(OUT_DIR, { recursive: true });
rmSync(ZIP, { force: true });
execSync(`cd "${BUILD}" && zip -qr "${ZIP}" META-INF jcr_root`);
rmSync(BUILD, { recursive: true, force: true });

/* eslint-disable no-console */
console.log(`Created ${ZIP} (${Math.round(readFileSync(ZIP).length / 1024)} KB)`);
console.log(`Install in AEM Package Manager, then publish ${SITE}/${PAGE_PATH}`);
