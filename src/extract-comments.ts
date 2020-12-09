import { readFile } from 'fs-extra'
import { TSDocParser, DocNode, DocExcerpt, TextRange, TSDocConfiguration, TSDocTagDefinition, TSDocTagSyntaxKind } from '@microsoft/tsdoc'
import * as ts from 'typescript'
import { EOL } from 'os'
import { getSourceFile } from './typescript-compiler';

export class Formatter {
  public static renderDocNode(docNode: DocNode): string {
    let result: string = '';
    if (docNode) {
      if (docNode instanceof DocExcerpt) {
        result += docNode.content.toString();
      }
      for (const childNode of docNode.getChildNodes()) {
        result += Formatter.renderDocNode(childNode);
      }
    }
    return result;
  }

  public static renderDocNodes(docNodes: ReadonlyArray<DocNode>): string {
    let result: string = '';
    for (const docNode of docNodes) {
      result += Formatter.renderDocNode(docNode);
    }
    return result;
  }
}

export function comments (source: string) {
  const tsdocParser = new TSDocParser()
  const parserContext = tsdocParser.parseString(source)
  console.log('lines', JSON.stringify(parserContext.lines.map((x) => x.toString()), null, 2))
  // if (parserContext.log.messages.length === 0) console.log('No errors or warnings.')
  // else {
  //   for (const message of parserContext.log.messages) {
  //     console.log(path + message.toString())
  //   }
  // }
  const docComment = parserContext.docComment
  return Formatter.renderDocNode(docComment.summarySection)
}

function isDeclarationKind(kind: ts.SyntaxKind): boolean {
  return (
    kind === ts.SyntaxKind.ArrowFunction ||
    kind === ts.SyntaxKind.BindingElement ||
    kind === ts.SyntaxKind.ClassDeclaration ||
    kind === ts.SyntaxKind.ClassExpression ||
    kind === ts.SyntaxKind.Constructor ||
    kind === ts.SyntaxKind.EnumDeclaration ||
    kind === ts.SyntaxKind.EnumMember ||
    kind === ts.SyntaxKind.ExportSpecifier ||
    kind === ts.SyntaxKind.FunctionDeclaration ||
    kind === ts.SyntaxKind.FunctionExpression ||
    kind === ts.SyntaxKind.GetAccessor ||
    kind === ts.SyntaxKind.ImportClause ||
    kind === ts.SyntaxKind.ImportEqualsDeclaration ||
    kind === ts.SyntaxKind.ImportSpecifier ||
    kind === ts.SyntaxKind.InterfaceDeclaration ||
    kind === ts.SyntaxKind.JsxAttribute ||
    kind === ts.SyntaxKind.MethodDeclaration ||
    kind === ts.SyntaxKind.MethodSignature ||
    kind === ts.SyntaxKind.ModuleDeclaration ||
    kind === ts.SyntaxKind.NamespaceExportDeclaration ||
    kind === ts.SyntaxKind.NamespaceImport ||
    kind === ts.SyntaxKind.Parameter ||
    kind === ts.SyntaxKind.PropertyAssignment ||
    kind === ts.SyntaxKind.PropertyDeclaration ||
    kind === ts.SyntaxKind.PropertySignature ||
    kind === ts.SyntaxKind.SetAccessor ||
    kind === ts.SyntaxKind.ShorthandPropertyAssignment ||
    kind === ts.SyntaxKind.TypeAliasDeclaration ||
    kind === ts.SyntaxKind.TypeParameter ||
    kind === ts.SyntaxKind.VariableDeclaration ||
    kind === ts.SyntaxKind.JSDocTypedefTag ||
    kind === ts.SyntaxKind.JSDocCallbackTag ||
    kind === ts.SyntaxKind.JSDocPropertyTag
  );
}

function getJSDocCommentRanges(node: ts.Node, text: string): ts.CommentRange[] {
  const commentRanges: ts.CommentRange[] = [];

  switch (node.kind) {
    case ts.SyntaxKind.Parameter:
    case ts.SyntaxKind.TypeParameter:
    case ts.SyntaxKind.FunctionExpression:
    case ts.SyntaxKind.ArrowFunction:
    case ts.SyntaxKind.ParenthesizedExpression:
      commentRanges.push(...(ts.getTrailingCommentRanges(text, node.pos) || []));
      break;
  }
  commentRanges.push(...(ts.getLeadingCommentRanges(text, node.pos) || []));

  // True if the comment starts with '/**' but not if it is '/**/'
  return commentRanges.filter(
    (comment) =>
      text.charCodeAt(comment.pos + 1) === 0x2a /* ts.CharacterCodes.asterisk */ &&
      text.charCodeAt(comment.pos + 2) === 0x2a /* ts.CharacterCodes.asterisk */ &&
      text.charCodeAt(comment.pos + 3) !== 0x2f /* ts.CharacterCodes.slash */
  );
}

interface IFoundComment {
  compilerNode: ts.Node
  textRange: TextRange
}

function walkCompilerAstAndFindComments(node: ts.Node, indent: string, foundComments: IFoundComment[]): void {
  // The TypeScript AST doesn't store code comments directly.  If you want to find *every* comment,
  // you would need to rescan the SourceFile tokens similar to how tsutils.forEachComment() works:
  // https://github.com/ajafff/tsutils/blob/v3.0.0/util/util.ts#L453

  let foundCommentsSuffix: string = '';
  const buffer: string = node.getSourceFile().getFullText(); // don't use getText() here!

  // Only consider nodes that are part of a declaration form.  Without this, we could discover
  // the same comment twice (e.g. for a MethodDeclaration and its PublicKeyword).
  if (isDeclarationKind(node.kind)) {
    // Find "/** */" style comments associated with this node.
    // Note that this reinvokes the compiler's scanner -- the result is not cached.
    const comments: ts.CommentRange[] = getJSDocCommentRanges(node, buffer);

    if (comments.length > 0) {
      if (comments.length === 1) {
        foundCommentsSuffix = `  (FOUND 1 COMMENT)`
      } else {
        foundCommentsSuffix = `  (FOUND ${comments.length} COMMENTS)`
      }

      for (const comment of comments) {
        foundComments.push({
          compilerNode: node,
          textRange: TextRange.fromStringRange(buffer, comment.pos, comment.end)
        });
      }
    }
  }

  return node.forEachChild((child) => walkCompilerAstAndFindComments(child, indent + '  ', foundComments));
}

function parseTSDoc(foundComment: IFoundComment): void {
  console.log(foundComment.textRange.toString())

  const customConfiguration = new TSDocConfiguration()

  const customInlineDefinition = new TSDocTagDefinition({
    tagName: '@customInline',
    syntaxKind: TSDocTagSyntaxKind.InlineTag,
    allowMultiple: true
  });

  // NOTE: Defining this causes a new DocBlock to be created under docComment.customBlocks.
  // Otherwise, a simple DocBlockTag would appear inline in the @remarks section.
  const customBlockDefinition: TSDocTagDefinition = new TSDocTagDefinition({
    tagName: '@customBlock',
    syntaxKind: TSDocTagSyntaxKind.BlockTag
  });

  // NOTE: Defining this causes @customModifier to be removed from its section,
  // and added to the docComment.modifierTagSet
  const customModifierDefinition: TSDocTagDefinition = new TSDocTagDefinition({
    tagName: '@customModifier',
    syntaxKind: TSDocTagSyntaxKind.ModifierTag
  });

  customConfiguration.addTagDefinitions([
    customInlineDefinition,
    customBlockDefinition,
    customModifierDefinition
  ]);

  const tsdocParser: TSDocParser = new TSDocParser(customConfiguration);
  const parserContext = tsdocParser.parseRange(foundComment.textRange);
  const docComment = parserContext.docComment

  if (parserContext.log.messages.length === 0) {
    console.log('No errors or warnings.');
  } else {
    const sourceFile: ts.SourceFile = foundComment.compilerNode.getSourceFile();
    for (const message of parserContext.log.messages) {
      // Since we have the compiler's analysis, use it to calculate the line/column information,
      // since this is currently faster than TSDoc's TextRange.getLocation() lookup.
      const location: ts.LineAndCharacter = sourceFile.getLineAndCharacterOfPosition(message.textRange.pos);
      const formattedMessage: string = `${sourceFile.fileName}(${location.line + 1},${
        location.character + 1
      }): [TSDoc] ${message}`;
      console.log(formattedMessage);
    }
  }
}

export async function parse (path: string) {
  const foundComments: IFoundComment[] = []
  walkCompilerAstAndFindComments(getSourceFile(path), '', foundComments)
  if (foundComments.length === 0) console.log('Error: No code comments were found in the input file')
  // foundComments.map(comment => parseTSDoc(comment))
  return foundComments.map(foundComment => comments(foundComment.textRange.toString()))
}
