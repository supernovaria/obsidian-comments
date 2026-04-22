import { debounce, EditorPosition, EventRef, ItemView, MarkdownPostProcessorContext, MarkdownView, Menu, Plugin, TAbstractFile, TFile, WorkspaceLeaf } from 'obsidian';

// Claude logo path from claude.com/favicon.svg
const CLAUDE_PATH = 'M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z'

// Build SVG elements via raw DOM API — no Obsidian prototype dependencies
const SVG_NS = 'http://www.w3.org/2000/svg'
type SvgTag = 'path' | 'polyline' | 'line' | 'circle'
type SvgEl = { tag: SvgTag; attr: Record<string, string> }

function makeSvg(attrs: Record<string, string>): SVGSVGElement {
	const s = document.createElementNS(SVG_NS, 'svg') as SVGSVGElement
	for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, v)
	return s
}

function appendIcon(parent: HTMLElement, els: SvgEl[]): void {
	const s = makeSvg({ viewBox: '0 0 24 24', width: '14', height: '14', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })
	for (const el of els) {
		const child = document.createElementNS(SVG_NS, el.tag)
		for (const [k, v] of Object.entries(el.attr)) child.setAttribute(k, v)
		s.appendChild(child)
	}
	parent.appendChild(s)
}

function appendClaudeIcon(parent: HTMLElement): void {
	const s = makeSvg({ viewBox: '0 0 248 248', width: '14', height: '14', fill: 'none' })
	const p = document.createElementNS(SVG_NS, 'path')
	p.setAttribute('d', CLAUDE_PATH)
	p.setAttribute('fill', '#D97757')
	s.appendChild(p)
	parent.appendChild(s)
}

const ICON_PREV:  SvgEl[] = [{ tag: 'polyline', attr: { points: '18 15 12 9 6 15' } }]
const ICON_NEXT:  SvgEl[] = [{ tag: 'polyline', attr: { points: '6 9 12 15 18 9' } }]
const ICON_HIDE:  SvgEl[] = [
	{ tag: 'path', attr: { d: 'M9.88 9.88a3 3 0 1 0 4.24 4.24' } },
	{ tag: 'path', attr: { d: 'M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68' } },
	{ tag: 'path', attr: { d: 'M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61' } },
	{ tag: 'line', attr: { x1: '2', x2: '22', y1: '2', y2: '22' } }
]
const ICON_SHOW:  SvgEl[] = [
	{ tag: 'path',   attr: { d: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z' } },
	{ tag: 'circle', attr: { cx: '12', cy: '12', r: '3' } }
]
const ICON_TRASH: SvgEl[] = [
	{ tag: 'path', attr: { d: 'M3 6h18' } },
	{ tag: 'path', attr: { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' } },
	{ tag: 'path', attr: { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' } }
]
const ICON_CHECK: SvgEl[] = [{ tag: 'path', attr: { d: 'M20 6 9 17l-5-5' } }]

interface Comment {
	name: string
	content: string
	startPos: EditorPosition
	endPos: EditorPosition
	contentPos: EditorPosition
	children: Comment[]
	file: TFile
	timestamp: Date | undefined
	childrenHidden?: boolean
	anchorId?: string
	anchorPos?: EditorPosition
	anchorText?: string
}

interface AllComments {
	[key: string]: Comment[]
}

const VIEW_TYPE_COMMENT = 'comment-view'
const CLAUDE_AUTHOR = 'Claude'

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export default class CommentPlugin extends Plugin {
	debounceUpdate = debounce(this.updateComments, 500, true)
	mdView: MarkdownView
	modifyListener: EventRef
	fileOpenListener: EventRef

	async onload() {
		const mdView = this.app.workspace.getActiveViewOfType(MarkdownView)
		if (!mdView) {
			console.error("Could not get active markdown view when setting up plugin")
			return
		}

		this.registerMarkdownPostProcessor(this.postProcessor.bind(this))

		this.mdView = mdView
		this.addRibbonIcon('message-circle', 'Comments', () => {
			this.activateView();
		});

		this.registerView(
			VIEW_TYPE_COMMENT,
			(leaf) => new CommentView(leaf, this)
		)

		this.modifyListener = this.app.vault.on('modify', file => {
			this.debounceUpdate(file)
		})

		this.fileOpenListener = this.app.workspace.on('file-open', file => {
			if (file) this.updateComments(file)
		})

		this.addCommand({
			id: 'add',
			name: 'Add comment at the current cursor position',
			editorCallback(editor) {
				const from = editor.getCursor('from')
				const to = editor.getCursor('to')
				const selected = editor.getSelection()
				const dateStr = new Date().toLocaleDateString()

				if (selected && from.line === to.line) {
					const cid = 'c' + Math.random().toString(36).slice(2, 8)
					editor.replaceRange(`<mark data-cid="${cid}">${selected}</mark>`, from, to)
					const updatedLine = editor.getLine(from.line)
					const lineEndPos = { line: from.line, ch: updatedLine.length }
					editor.replaceRange(`\n> [!comment] NAME | ${dateStr} | cid:${cid}\n> COMMENT`, lineEndPos)
				} else {
					editor.replaceRange(`> [!comment] NAME | ${dateStr}\n> COMMENT`, from, to)
				}
			},
		})
	}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_COMMENT);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return
			await leaf.setViewState({ type: VIEW_TYPE_COMMENT, active: true });
		}

		workspace.revealLeaf(leaf);
	}

	onunload() {
		this.app.workspace.offref(this.modifyListener)
		this.app.workspace.offref(this.fileOpenListener)
	}

	postProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext) {
		if (this.mdView.getMode() == 'source') return;
		let callouts = el.findAll(".callout").filter(c => c.getAttribute('data-callout')?.toLowerCase() === 'comment')
		callouts.forEach(c => {
			c.hide()
		})
	}

	async updateComments(file: TAbstractFile) {
		if (!(file instanceof TFile)) return

		const content = await file.vault.cachedRead(file)
		const comments = this.findComments(file, content, { line: 0, ch: 0 }, undefined, content)

		this.app.workspace.getLeavesOfType(VIEW_TYPE_COMMENT).forEach(leaf => {
			if (leaf.view instanceof CommentView) leaf.view.setComments(comments, file.name)
		})
	}

	findComments(file: TFile, fileContent: string, posOffset: EditorPosition, parentContentPos?: EditorPosition, rootContent?: string): Comment[] {
		const comments: Comment[] = []
		const regex = /> \[!comment\] (.+?)\n((?:> *.*\n?)+)/gi;
		const matches = fileContent.matchAll(regex)

		for (const match of matches) {
			let timestamp: Date | undefined
			let contentPos: EditorPosition
			let anchorId: string | undefined
			let anchorPos: EditorPosition | undefined
			let anchorText: string | undefined

			if (!match.index) {
				continue;
			}

			// Parse header parts: NAME [| DATE] [| cid:xxx]
			const headerParts = match[1].trim().split(' | ')
			let name = headerParts[0].trim()

			for (let i = 1; i < headerParts.length; i++) {
				const part = headerParts[i].trim()
				if (part.startsWith('cid:')) {
					anchorId = part.slice(4)
				} else {
					const day = parseInt(part.slice(0, 2))
					const month = parseInt(part.slice(3, 5))
					const year = parseInt(part.slice(6))
					if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
						timestamp = new Date(year, month - 1, day)
					}
				}
			}

			let content = match[2].split('\n')
				.map(line => line.replace(/^>/, '').trim())
				.join('\n')

			const startLine = (fileContent.slice(0, match.index).match(/\n/g)?.length || -1) + 1
			const endLine = (fileContent.slice(0, match.index + match[0].length).match(/\n/g)?.length || -1) + 1
			const startPos = { line: startLine + posOffset.line, ch: 0 }
			const endPos = { line: endLine + posOffset.line, ch: 0 }

			if (!parentContentPos) contentPos = { line: endPos.line, ch: 0 }
			else contentPos = parentContentPos

			// Resolve anchor position by searching the full file content
			if (anchorId && rootContent) {
				const markRe = new RegExp(`<mark data-cid="${escapeRegex(anchorId)}">[\\s\\S]*?<\\/mark>`)
				const markMatch = rootContent.match(markRe)
				if (markMatch && markMatch.index !== undefined) {
					const before = rootContent.slice(0, markMatch.index)
					const anchorLine = before.match(/\n/g)?.length ?? 0
					const lastNl = before.lastIndexOf('\n')
					anchorPos = { line: anchorLine, ch: markMatch.index - (lastNl + 1) }
					const inner = markMatch[0].replace(/^<mark[^>]*>/, '').replace(/<\/mark>$/, '')
					anchorText = inner.replace(/\n/g, ' ').trim()
					if (anchorText.length > 60) anchorText = anchorText.slice(0, 57) + '...'
				}
			}

			const children = this.findComments(file, content, { line: startPos.line, ch: 0 }, contentPos, rootContent)

			if (content.indexOf('>') >= 0)
				content = content.slice(0, content.indexOf('>'))

			comments.push({ name, content, startPos, endPos, children, contentPos, file, timestamp, childrenHidden: true, anchorId, anchorPos, anchorText })
		}

		return comments
	}
}

class CommentView extends ItemView {
	private comments: AllComments = {};
	private commentsEl: HTMLElement
	private plugin: CommentPlugin
	private currentFileName: string = ''
	private currentCommentIndex: number = -1
	private commentEls: HTMLElement[] = []
	private hideToggleBtn: HTMLButtonElement

	constructor(leaf: WorkspaceLeaf, plugin: CommentPlugin) {
		super(leaf)
		this.plugin = plugin
	}

	getIcon(): string {
		return 'message-circle'
	}

	getViewType() {
		return VIEW_TYPE_COMMENT
	}

	getDisplayText() {
		return 'Comments'
	}

	setComments(comments: Comment[], fileName: string) {
		this.comments[fileName]?.forEach(prevComment => {
			const i = comments.findIndex(newComment =>
				prevComment.startPos === newComment.startPos &&
				prevComment.content === newComment.content
			)
			if (i >= 0) comments[i].childrenHidden = prevComment.childrenHidden
		})

		this.comments[fileName] = comments
		this.currentFileName = fileName
		this.renderComments(fileName)
	}

	renderComments(fileName: string) {
		this.commentsEl.empty()
		this.commentEls = []

		const comments = this.comments[fileName] || []

		if (comments.length === 0) {
			this.commentsEl.createEl('p', { text: 'No comments', cls: 'comments-empty' })
			return
		}

		comments.forEach((comment, index) => {
			const isClaude = comment.name.trim() === CLAUDE_AUTHOR

			const commentContainer = this.commentsEl.createEl('div', {
				cls: `comment-item-container${isClaude ? ' comment-claude' : ''}`,
			});
			this.commentEls.push(commentContainer)

			// Header: Line X | [icon] Author | [✓] [+/-]
			const headerDiv = commentContainer.createEl('div', { cls: 'comment-header' })

			headerDiv.createEl('b', {
				text: `Line ${comment.endPos.line}`,
				cls: 'comment-line'
			})

			const authorEl = headerDiv.createEl('div', { cls: 'comment-author' })
			if (isClaude) {
				const iconEl = authorEl.createEl('span', { cls: 'comment-claude-icon' })
				appendClaudeIcon(iconEl)
			}
			authorEl.createEl('i', {
				text: comment.name.trim(),
				cls: 'comment-name'
			})

			const resolveBtn = headerDiv.createEl('button', { cls: 'comment-resolve-btn' })
			resolveBtn.setAttribute('aria-label', 'Resolve comment')
			appendIcon(resolveBtn, ICON_CHECK)
			resolveBtn.addEventListener('click', (e) => {
				e.stopPropagation()
				this.removeComment(comment)
			})

			const minimizeEl = headerDiv.createEl('button', { cls: 'comment-minimize' })
			minimizeEl.setText('+')

			// Anchor badge — shown when comment is tied to a specific text span
			if (comment.anchorText) {
				commentContainer.createEl('span', {
					text: `"${comment.anchorText}"`,
					cls: 'comment-anchor-badge'
				})
			}

			// Body: comment text only
			const commentItem = commentContainer.createEl('div', { cls: 'comment-item' })
			commentItem.createEl('p', {
				text: comment.content,
				cls: 'comment-item-text'
			});

			if (comment.children.length > 0) {
				const childrenCommentsEl = commentContainer.createEl('div', { cls: 'comment-children' })
				hideChildren(childrenCommentsEl)

				this.renderChildrenComments(comment.children, fileName, childrenCommentsEl)

				minimizeEl.addEventListener('click', () => {
					if (isHidden(childrenCommentsEl)) {
						showChildren(childrenCommentsEl)
						minimizeEl.setText('-')
					} else {
						hideChildren(childrenCommentsEl)
						minimizeEl.setText('+')
					}
				})
			} else {
				minimizeEl.hide()
				minimizeEl.setAttr('hidden', true)
			}

			commentItem.addEventListener('click', () => {
				this.currentCommentIndex = index
				this.highlightComment(index)
				this.navigateToComment(comment)
			});
			commentItem.addEventListener('contextmenu', (evt) => this.showCommentOptions(evt, comment, false))
		})

		if (this.currentCommentIndex >= 0 && this.currentCommentIndex < this.commentEls.length) {
			this.highlightComment(this.currentCommentIndex)
		}
	}

	private highlightComment(index: number) {
		this.commentEls.forEach((el, i) => {
			el.toggleClass('comment-active', i === index)
		})
		this.commentEls[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
	}

	renderChildrenComments(comments: Comment[], fileName: string, element: HTMLElement) {
		element.empty()

		comments.forEach(comment => {
			const commentContainer = element.createEl('div', { cls: 'comment-child-container' });

			commentContainer.createEl('div', { cls: 'comment-child-separator' })

			const headerDiv = commentContainer.createEl('div', { cls: 'comment-header' })

			const authorEl = headerDiv.createEl('div', { cls: 'comment-author' })
			authorEl.createEl('i', {
				text: comment.name,
				cls: 'comment-name'
			})

			const commentItem = commentContainer.createEl('div', { cls: 'comment-child' })

			commentItem.createEl('p', {
				text: comment.content,
				cls: 'comment-child-text'
			});

			commentItem.addEventListener('click', () => this.navigateToComment(comment));
			commentItem.addEventListener('contextmenu', (evt) => this.showCommentOptions(evt, comment, true))
		})
	}

	private async navigateToComment(comment: Comment) {
		// Find the file if it's already open in a leaf
		const leaves = this.app.workspace.getLeavesOfType('markdown')
		const existingLeaf = leaves.find(leaf =>
			(leaf.view as MarkdownView).file?.path === comment.file.path
		)

		if (existingLeaf) {
			this.app.workspace.setActiveLeaf(existingLeaf, { focus: true })
		} else {
			await this.app.workspace.getLeaf(false).openFile(comment.file)
		}

		const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor
		if (editor) {
			const pos = comment.anchorPos ?? comment.contentPos
			editor.setCursor(pos)
			editor.scrollIntoView({ from: pos, to: pos }, true)
		}
	}

	private showCommentOptions(evt: MouseEvent, comment: Comment, child: boolean) {
		const menu = new Menu()
		let addTitle = "Add subcomment"
		let removeTitle = "Remove entire comment"

		if (child) {
			addTitle = "Add follow-up subcomment"
			removeTitle = "Remove subcomment"
		}

		menu.addItem(item => {
			item
				.setTitle(addTitle)
				.setIcon("plus")
				.onClick(() => this.addComment(comment))
		})

		menu.addItem(item => {
			item
				.setTitle(removeTitle)
				.setIcon('trash')
				.onClick(() => this.removeComment(comment))
		})

		menu.showAtMouseEvent(evt)
	}

	private addComment(comment: Comment) {
		this.app.vault.process(comment.file, content => {
			const lines = content.split('\n')
			lines.splice(comment.endPos.line - 1, 0, "> ", `>> [!comment] NAME | ${new Date().toLocaleDateString()}`, ">> COMMENT")
			content = lines.join('\n')
			return content
		})
	}

	private async removeComment(comment: Comment) {
		await this.app.vault.process(comment.file, content => {
			// Strip the <mark> wrapper, preserving the inner text
			if (comment.anchorId) {
				const cid = comment.anchorId
				content = content.replace(
					new RegExp(`<mark data-cid="${escapeRegex(cid)}">((?:[\\s\\S]*?))<\\/mark>`),
					'$1'
				)
			}
			const lines = content.split('\n')
			lines.splice(comment.startPos.line - 1, comment.endPos.line - comment.startPos.line)
			content = lines.join('\n')
			return content
		})

		this.comments[comment.file.name].remove(comment)
		this.renderComments(comment.file.name)
	}

	private navigateNext() {
		const comments = this.comments[this.currentFileName]
		if (!comments || comments.length === 0) return
		this.currentCommentIndex = (this.currentCommentIndex + 1) % comments.length
		this.navigateToComment(comments[this.currentCommentIndex])
		this.highlightComment(this.currentCommentIndex)
	}

	private navigatePrev() {
		const comments = this.comments[this.currentFileName]
		if (!comments || comments.length === 0) return
		this.currentCommentIndex = this.currentCommentIndex <= 0
			? comments.length - 1
			: this.currentCommentIndex - 1
		this.navigateToComment(comments[this.currentCommentIndex])
		this.highlightComment(this.currentCommentIndex)
	}

	private async deleteAllComments() {
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) return

		const comments = this.comments[activeFile.name]
		if (!comments || comments.length === 0) return

		if (!window.confirm(`Delete all ${comments.length} comment(s)? This cannot be undone.`)) return

		await this.app.vault.process(activeFile, (content) => {
			// Strip all mark wrappers, preserving inner text
			content = content.replace(/<mark data-cid="[^"]*">([\s\S]*?)<\/mark>/g, '$1')
			// Strip %% wrappers that contain only a comment callout
			content = content.replace(/%%\n(> \[!comment\][^\n]*\n(?:> (?!\[!comment\])[^\n]*\n?)*)\n*%%\n?/g, '$1')
			// Remove the comment callouts themselves
			content = content.replace(/> \[!comment\][^\n]*\n(?:> (?!\[!comment\])[^\n]*\n?)*/g, '')
			return content
		})

		this.comments[activeFile.name] = []
		this.currentCommentIndex = -1
		this.renderComments(activeFile.name)
	}

	private async toggleHideAllComments() {
		const activeFile = this.app.workspace.getActiveFile()
		if (!activeFile) return

		const content = await this.app.vault.read(activeFile)
		const areHidden = content.includes('%%\n> [!comment]')

		await this.app.vault.process(activeFile, (c) => {
			if (areHidden) {
				return c.replace(/%%\n(> \[!comment\][^\n]*\n(?:> (?!\[!comment\])[^\n]*\n?)*)\n*%%\n?/g, '$1')
			} else {
				return c.replace(/(> \[!comment\] [^\n]+\n(?:> (?!\[!comment\])[^\n]*\n?)*)/g, (match) => {
					return `%%\n${match.trimEnd()}\n\n%%\n`
				})
			}
		})

		this.hideToggleBtn.empty()
		appendIcon(this.hideToggleBtn, areHidden ? ICON_HIDE : ICON_SHOW)
		this.hideToggleBtn.setAttribute('aria-label', areHidden ? 'Hide all comments' : 'Show all comments')
	}

	async onOpen() {
		const container = this.containerEl.children[1]
		container.empty()

		const commentContainer = container.createEl('div', { cls: 'comments-wrapper' })
		commentContainer.createEl('h2', { text: 'Comments', cls: 'comments-title' })

		const toolbar = commentContainer.createEl('div', { cls: 'comments-toolbar' })

		const navDiv = toolbar.createEl('div', { cls: 'comments-nav' })

		const prevBtn = navDiv.createEl('button', { cls: 'comments-nav-btn' })
		prevBtn.setAttribute('aria-label', 'Previous comment')
		appendIcon(prevBtn, ICON_PREV)
		prevBtn.addEventListener('click', () => this.navigatePrev())

		const nextBtn = navDiv.createEl('button', { cls: 'comments-nav-btn' })
		nextBtn.setAttribute('aria-label', 'Next comment')
		appendIcon(nextBtn, ICON_NEXT)
		nextBtn.addEventListener('click', () => this.navigateNext())

		const actionsDiv = toolbar.createEl('div', { cls: 'comments-actions' })

		this.hideToggleBtn = actionsDiv.createEl('button', { cls: 'comments-action-btn' })
		this.hideToggleBtn.setAttribute('aria-label', 'Hide all comments')
		appendIcon(this.hideToggleBtn, ICON_HIDE)
		this.hideToggleBtn.addEventListener('click', () => this.toggleHideAllComments())

		const deleteAllBtn = actionsDiv.createEl('button', { cls: 'comments-action-btn comments-delete-all-btn' })
		deleteAllBtn.setAttribute('aria-label', 'Delete all comments')
		appendIcon(deleteAllBtn, ICON_TRASH)
		deleteAllBtn.addEventListener('click', () => this.deleteAllComments())

		this.commentsEl = commentContainer.createEl('div', { cls: 'comments-list' })

		const activeFile = this.app.workspace.getActiveFile()
		if (activeFile) this.plugin.updateComments(activeFile)
	}

	async onClose() { }
}

function hideChildren(children: HTMLDivElement) {
	children.addClass('hidden')
}

function showChildren(children: HTMLDivElement) {
	children.removeClass('hidden')
}

function isHidden(children: HTMLDivElement) {
	return children.classList.contains('hidden')
}
