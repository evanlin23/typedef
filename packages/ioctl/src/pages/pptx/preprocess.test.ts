import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { BULLET_END, BULLET_START, LINE_BREAK, preparePptx } from './preprocess';

const NS = {
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  p: 'http://schemas.openxmlformats.org/presentationml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
};
const XMLNS = `xmlns:a="${NS.a}" xmlns:p="${NS.p}" xmlns:r="${NS.r}"`;
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const SLIDE_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml';

const rels = (...items: [string, string, string][]) =>
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items
    .map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`)
    .join('')}</Relationships>`;

const titleShape = (text: string) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:spPr/>` +
  `<p:txBody><a:bodyPr/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
const bodyShape = (...paragraphs: string[]) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>` +
  `<p:txBody><a:bodyPr/>${paragraphs.map((p) => `<a:p>${p}</a:p>`).join('')}</p:txBody></p:sp>`;
const slide = (shapes: string, attrs = '') => `<p:sld ${XMLNS}${attrs}><p:cSld><p:spTree>${shapes}</p:spTree></p:cSld></p:sld>`;

// A presentation whose slide files are out of order, with a hidden slide
async function makePresentation() {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${[1, 2, 3]
      .map((n) => `<Override PartName="/ppt/slides/slide${n}.xml" ContentType="${SLIDE_TYPE}"/>`)
      .join('')}</Types>`
  );
  zip.file(
    'ppt/presentation.xml',
    `<p:presentation ${XMLNS}><p:sldIdLst><p:sldId id="256" r:id="rId3"/><p:sldId id="257" r:id="rId1"/><p:sldId id="258" r:id="rId2"/></p:sldIdLst>` +
      `<p:sldSz cx="9144000" cy="6858000"/></p:presentation>`
  );
  zip.file('ppt/_rels/presentation.xml.rels', rels(['rId1', 'slide', 'slides/slide1.xml'], ['rId2', 'slide', 'slides/slide2.xml'], ['rId3', 'slide', 'slides/slide3.xml']));
  zip.file(
    'ppt/slides/slide1.xml',
    slide(
      titleShape('second') +
        `<p:sp><p:nvSpPr><p:cNvPr id="5" name="Number"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/>` +
        `<a:p><a:fld id="{1}" type="slidenum"><a:rPr sz="1400"/><a:t>7</a:t></a:fld></a:p></p:txBody></p:sp>` +
        bodyShape('<a:r><a:t>Point</a:t></a:r>', '<a:r><a:t>one</a:t></a:r><a:br/><a:r><a:t>two</a:t></a:r>') +
        `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="4" name="Table"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr><p:xfrm/>` +
        `<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr><a:tableStyleId>{69012ECD-51FC-41F1-AA8D-1B2483CD663E}</a:tableStyleId></a:tblPr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    )
  );
  zip.file('ppt/slides/slide2.xml', slide(titleShape('hidden'), ' show="0"'));
  zip.file('ppt/slides/slide3.xml', slide(titleShape('first')));
  for (const n of [1, 2, 3]) zip.file(`ppt/slides/_rels/slide${n}.xml.rels`, rels(['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml']));
  zip.file('ppt/slideLayouts/slideLayout1.xml', `<p:sldLayout ${XMLNS}><p:cSld><p:spTree/></p:cSld></p:sldLayout>`);
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels(['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']));
  zip.file(
    'ppt/slideMasters/slideMaster1.xml',
    `<p:sldMaster ${XMLNS}><p:cSld><p:spTree/></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2"/><p:txStyles>` +
      `<p:titleStyle><a:lvl1pPr><a:defRPr cap="all" sz="4400"/></a:lvl1pPr></p:titleStyle>` +
      `<p:bodyStyle><a:lvl1pPr marL="342900" indent="-342900"><a:buChar char="•"/><a:defRPr sz="3200"/></a:lvl1pPr></p:bodyStyle>` +
      `</p:txStyles></p:sldMaster>`
  );
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels());
  return zip;
}

const text = async (zip: JSZip, file: string) => (await zip.file(file)?.async('text')) ?? '';

describe('preparePptx', () => {
  it('puts slides in presentation order and drops hidden slides', async () => {
    const zip = await makePresentation();
    await preparePptx(zip);
    expect(zip.file('ppt/slides/slide3.xml')).toBeNull();
    expect(await text(zip, 'ppt/slides/slide1.xml')).toContain('FIRST');
    expect(await text(zip, 'ppt/slides/slide2.xml')).toContain('SECOND');
    const types = await text(zip, '[Content_Types].xml');
    expect(types.match(/slides\/slide\d+\.xml/g)).toEqual(['slides/slide1.xml', 'slides/slide2.xml']);
  });

  it('writes out inherited bullets, line breaks and capitals', async () => {
    const zip = await makePresentation();
    await preparePptx(zip);
    const xml = await text(zip, 'ppt/slides/slide2.xml');
    // Both body paragraphs get the master's bullet
    expect(xml.split(`${BULLET_START}•${BULLET_END}`)).toHaveLength(3);
    expect(xml).toContain(LINE_BREAK);
    expect(xml).not.toContain('<a:br');
    // The master capitalizes titles
    expect(xml).toContain('SECOND');
  });

  it('numbers slides like PowerPoint and turns fields into plain runs', async () => {
    const zip = await makePresentation();
    // The hidden slide still counts: it's listed before the second slide here
    const presentation = (await text(zip, 'ppt/presentation.xml')).replace(
      '<p:sldId id="257" r:id="rId1"/><p:sldId id="258" r:id="rId2"/>',
      '<p:sldId id="258" r:id="rId2"/><p:sldId id="257" r:id="rId1"/>'
    );
    zip.file('ppt/presentation.xml', presentation);
    const { slideNumbers } = await preparePptx(zip);
    expect(slideNumbers).toEqual([1, 3]);
    const xml = await text(zip, 'ppt/slides/slide2.xml');
    expect(xml).not.toContain('<a:fld');
    expect(xml).toMatch(/<a:r><a:rPr sz="1400"\/><a:t>3<\/a:t><\/a:r>/);
  });

  it('defines built-in table styles the presentation uses', async () => {
    const zip = await makePresentation();
    await preparePptx(zip);
    const styles = await text(zip, 'ppt/tableStyles.xml');
    expect(styles).toContain('{69012ECD-51FC-41F1-AA8D-1B2483CD663E}');
    expect(styles).toContain('Light Style 2 - Accent 1');
  });
});
