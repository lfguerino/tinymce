import { Behaviour, DomFactory, Gui, GuiFactory, Positioning } from '@ephox/alloy';
import { AlloyComponent } from '@ephox/alloy/lib/main/ts/ephox/alloy/api/component/ComponentApi';
import { Arr, Merger, Obj, Option, Result } from '@ephox/katamari';
import { Css } from '@ephox/sugar';
import DOMUtils from 'tinymce/core/api/dom/DOMUtils';
import { Editor } from 'tinymce/core/api/Editor';
import { getMinHeightSetting, getMinWidthSetting } from './api/Settings';
import * as Backstage from './backstage/Backstage';
import ContextToolbar from './ContextToolbar';
import Events from './Events';
import Iframe from './modes/Iframe';
import Inline from './modes/Inline';
import OuterContainer from './ui/general/OuterContainer';
import * as SilverContextMenu from './ui/menus/contextmenu/SilverContextMenu';
import { renderStatusbar } from './ui/statusbar/Statusbar';

const setup = (editor) => {
  const isInline = editor.getParam('inline', false, 'boolean');
  const mode = isInline ? Inline : Iframe;

  const sink = GuiFactory.build({
    dom: DomFactory.fromHtml('<div class="tox tox-silver-sink tox-tinymce-aux"></div>'),
    behaviours: Behaviour.derive([
      Positioning.config({
        useFixed: false // this allows menus to scroll with the outer page, we don't want position: fixed
      })
    ])
  });

  const lazySink = () => Result.value<AlloyComponent, Error>(sink);

  const partMenubar = OuterContainer.parts().menubar({
    dom: {
      tag: 'div',
      classes: [ 'tox-menubar' ]
    },
    getSink: lazySink,
    providers: {
      icons: () => editor.ui.registry.getAll().icons
    },
    onEscape () {
      editor.focus();
    }
  });

  // TODO TINY-1659
  const partToolbar = OuterContainer.parts().toolbar({
    dom: {
      tag: 'div',
      classes: [ 'tox-toolbar' ]
    },

    onEscape() {
      editor.focus();
    }
  });

  const partSocket = OuterContainer.parts().socket({
    dom: {
      tag: 'div',
      classes: [ 'tox-edit-area' ]
    }
  });

  const partSidebar = OuterContainer.parts().sidebar({
    dom: {
      tag: 'div',
      classes: ['tox-sidebar']
    }
  });

  const statusbar = editor.getParam('statusbar', true, 'boolean') && !isInline ? Option.some(renderStatusbar(editor)) : Option.none();

  const socketSidebarContainer = {
    dom: {
      tag: 'div',
      classes: ['tox-sidebar-wrap']
    },
    components: [
      partSocket,
      partSidebar
    ]
  };

  // False should stop the menubar and toolbar rendering altogether
  const hasToolbar = editor.getParam('toolbar', true, 'boolean') !== false;
  const hasMenubar = editor.getParam('menubar', true, 'boolean') !== false;
  const editorComponents = Arr.flatten([
    hasMenubar ? [ partMenubar ] : [ ],
    hasToolbar ? [ partToolbar ] : [ ],
    // Inline mode does not have a status bar, nor a socket/sidebar
    isInline ? [ ] : [ socketSidebarContainer ],
    isInline ? [ ] : statusbar.toArray()
  ]);

  const outerContainer = GuiFactory.build(
    OuterContainer.sketch({
      dom: {
        tag: 'div',
        classes: ['tox', 'tox-tinymce'],
        styles: {
          // This is overridden by the skin, it helps avoid FOUC
          visibility: 'hidden'
        }
      },
      components: editorComponents,
      behaviours: Behaviour.derive(mode.getBehaviours(editor))
    })
  );

  editor.shortcuts.add('alt+F10', 'focus toolbar', function () {
    OuterContainer.focusToolbar(outerContainer);
  });

  const mothership = Gui.takeover(
    outerContainer
  );

  const uiMothership = Gui.takeover(sink);

  const backstage = Backstage.init(outerContainer, sink, editor);

  Events.setup(editor, mothership, uiMothership);

  const getUi = () => {
    const channels = {
      broadcastAll: uiMothership.broadcast,
      broadcastOn: uiMothership.broadcastOn,
      register: () => {}
    };

    return { channels };
  };

  const renderUI = function (editor: Editor, targetNode) {
    SilverContextMenu.setup(editor, lazySink, backstage.shared);

    // Apply Bridge types
    const { buttons, menuItems, contextToolbars } = editor.ui.registry.getAll();
    const rawUiConfig = {
      menuItems,
      buttons,

      // Apollo, not implemented yet, just patched to work
      menus: !editor.settings.menu ? {} : Obj.map(editor.settings.menu, (menu) => Merger.merge(menu, { items: menu.items })),
      menubar: editor.settings.menubar,
      toolbar: editor.settings.toolbar,

      // Apollo, not implemented yet
      sidebar: editor.sidebars ? editor.sidebars : []
    };

    ContextToolbar.register(editor, contextToolbars, sink, { backstage });

    // Set height and width if they were given, though height only applied to iframe mode
    let width, height, re;
    const settings = editor.settings;
    const elm = editor.getElement();

    const DOM = DOMUtils.DOM;

    width = settings.width || DOM.getStyle(elm, 'width') || '100%';
    height = settings.height || DOM.getStyle(elm, 'height') || Math.max(elm.offsetHeight, 300);
    const minHeight = getMinHeightSetting(editor);
    const minWidth = getMinWidthSetting(editor);
    re = /^[0-9\.]+(|px)$/i;

    if (re.test('' + width)) {
      width = minWidth.map((mw) => Math.max(parseInt(width, 10), mw)).getOr(width) + 'px';
    }

    if (re.test('' + height)) {
      height = minHeight.map((mh) => Math.max(parseInt(height, 10), mh)).getOr(height) + 'px';
    }
    if (width) {
      Css.set(outerContainer.element(), 'width', width);
    }
    if (!editor.inline && height) {
      Css.set(outerContainer.element(), 'height', height);
    }

    const uiComponents = {mothership, uiMothership, outerContainer};
    return mode.render(editor, uiComponents, rawUiConfig, backstage, elm);
  };

  return {mothership, uiMothership, backstage, renderUI, getUi};
};

export default {
  setup
};