/**
 * DataFormsJS General Utility Functions for Web Components
 */

/* Validates with both [jshint] and [eslint] */
/* For online eslint - Source Type = 'module' must be manually selected. */
/* jshint esversion:8 */
/* eslint-env browser, es6 */
/* eslint quotes: ["error", "single", { "avoidEscape": true }] */
/* eslint spaced-comment: ["error", "always"] */
/* eslint-disable no-console */
/* eslint no-async-promise-executor: "off" */
/* eslint no-prototype-builtins: "off" */

// Module level variable that is set only once
let polyfillIsNeeded = null;

/**
 * Default Error Styles used when calling `showError()` or `showErrorAlert()`.
 *
 * These can be overridden by using [!important] CSS rules or by including
 * the style sheet by ID on the page before Web Components load.
 */
const errorStyleId = 'dataformsjs-style-errors';
const errorCss = `
    .dataformsjs-error,
    .dataformsjs-fatal-error {
        color:#fff;
        background-color:red;
        box-shadow:0 1px 5px 0 rgba(0,0,0,.5);
        background-image:linear-gradient(#e00,#c00);
        // Next line is included but commented out because it should not show on mobile
        // however on desktop with DevTools the commented out version makes it easy for a
        // developer to toggle on errors that use line breaks and white space formatting.
        /* white-space:pre; */
        text-align: left;
    }

    .dataformsjs-error{
        padding:10px;
        font-size:1em;
        margin:5px;
        display:inline-block;
    }

    .dataformsjs-fatal-error {
        z-index:1000000;
        padding:20px;
        font-size:1.5em;
        margin:20px;
        position:fixed;
        top:10px;
    }

    @media only screen and (min-width:1000px){
        .dataformsjs-fatal-error {
            max-width:1000px;
            left:calc(50% - 520px);
        }
    }

    .dataformsjs-fatal-error span {
        padding:5px 10px;
        float:right;
        border:1px solid darkred;
        cursor:pointer;
        margin-left:10px;
        box-shadow:0 0 2px 1px rgba(0,0,0,0.3);
        background-image:linear-gradient(#c00,#a00);
        border-radius:5px;
    }
`;

/**
 * Helper function to convert special characters to HTML entities.
 *
 * Characters escaped are:
 *   -  & = \&amp;
 *   -  " = \&quot;
 *   -  ' = \&#039;
 *   -  < = \&lt;
 *   -  \> = \&gt;
 *
 * This is equivalent to the PHP code:
 *     htmlspecialchars($text, ENT_QUOTES, 'UTF-8')
 *
 * @param {string|null|undefined|number} text
 * @return {string|null|undefined|number}
 */
export function escapeHtml(text) {
    if (text === undefined || text === null || typeof text === 'number') {
        return text;
    }
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Tagged Template Literal function that escapes values for HTML.
 * Use it without parentheses like this [render\`\`] and not [render(\`\`)].
 *
 * @param {array} strings
 * @param  {...any} values
 * @return {string}
 */
export function render(strings, ...values) {
    const html = [strings[0]];
    for (let n = 0, m = values.length; n < m; n++) {
        html.push(escapeHtml(values[n]));
        html.push(strings[n+1]);
    }
    return html.join('');
}

/**
 * Build and return a URL. For example "/order/:id" becomes "/order/123"
 * if {id:123} is sent in the [params] parameter.
 * 
 * Global variables from the `window` object can be included when using
 * brackets. Example: "{rootApiUrl}/countries" will look for `window.rootApiUrl`.
 *
 * @param {string} url
 * @param {object} params
 * @return {string}
 */
export function buildUrl(url, params) {
    let newUrl = String(url);

    // Replace "{variables}" from the global Window Scope.
    newUrl = newUrl.replace(/\{(\w+)\}/g, function(match, offset) {
        if (typeof window[offset] === 'string') {
            return window[offset];
        }
        return match;
    });

    // Replace ":variables" from the params object
    if (params !== null && typeof params === 'object') {
        for (const prop in params) {
            if (params.hasOwnProperty(prop)) {
                if (newUrl.indexOf(':' + prop) > -1) {
                    newUrl = newUrl.replace(new RegExp(':' + prop, 'g'), encodeURIComponent(params[prop]));
                }
            }
        }
    }
    return newUrl;
}

/**
 * Set an elements [textContent] or [value] depending on the element type.
 *
 * Rules:
 *   - input[type='checkbox'] - [checked=true] if value is [true, 1, 'yes', 'y']
 *   - input, select, textarea - [value] is set
 *   - Custom Elements that define [value] will have it set. For example usage see [data-table.js].
 *   - All other elements will have [textContent] set with the value
 *
 * @param {HTMLElement|SVGElement} element
 * @param {*} value
 */
export function setElementText(element, value) {
    // Element must be passed
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
        console.warn('Called setElementText() with an invalid parameter');
        return;
    }

    // Set the value based on node type
    const nodeName = element.nodeName;
    switch (nodeName) {
        case 'INPUT':
            if (element.type === 'checkbox') {
                const lowerValue = String(value).toLowerCase();
                element.checked = (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes' || lowerValue === 'y');
            } else {
                element.value = (value === null ? '' : String(value));
            }
            break;
        case 'SELECT':
        case 'TEXTAREA':
            element.value = (value === null ? '' : String(value));
            break;
        default:
            if ((nodeName.includes('-') || element.getAttribute('is') !== null) && 'value' in element) {
                element.value = value;
            } else {
                element.textContent = (value === null ? '' : String(value));
            }
    }
}

/**
 * Used to get an object value for data binding. Key is either a property from the
 * object or a path such as "object.property". If the root object starts with
 * "window" then the global [window] object is used. Example: "window.location.href".
 *
 * @param {object} data
 * @param {string} key
 * @return {*}
 */
export function getBindValue(data, key) {
    const keys = key.split('.');
    let value = (keys.length > 1 && keys[0] === 'window' ? window : data);
    for (let n = 0, m = keys.length; n < m; n++) {
        value = (typeof value === 'object' && value !== null ? value[keys[n]] : null);
    }
    return (value === undefined ? null : value);
}

/**
 * Bind an Attribute Template. This is used for [url-attr-param]
 * and [data-bind-attr] to set an attribute value based on a template
 * and data. Use "[]" characters to specify the bind key in the related
 * attribute. Example:
 *     <a href="#/regions/[place.country_code]" data-bind-attr="href">Regions</a>
 *
 * @param {HTMLElement} element
 * @param {string} attribute
 * @param {object} data
 */
export function bindAttrTmpl(element, attribute, data) {
    // Split comma-delimited attributes and trim the string values
    const attributes = element.getAttribute(attribute).split(',').map(s => s.trim());
    for (const attr of attributes) {
        // Save bind template to an attribute, example:
        // [data-bind-attr="href"] will save the initial value from [href]
        // to [data-bind-attr-href]. This allows it to be re-used.
        let value = element.getAttribute(attribute + '-' + attr);
        if (value === null) {
            value = element.getAttribute(attr);
            if (value !== null) {
                element.setAttribute(attribute + '-' + attr, value);
            }
        }
        // Parse the template
        if (value !== null) {
            let loopCount = 0; // For safety to prevent endless loops
            const maxLoop = 100;
            while (loopCount < maxLoop) {
                const posStart = value.indexOf('[');
                const posEnd = value.indexOf(']');
                if (posStart === -1 || posEnd === -1 || posEnd < posStart) {
                    break;
                }
                const key = value.substring(posStart + 1, posEnd);
                let boundValue = getBindValue(data, key);
                if (boundValue === undefined) {
                    boundValue = '';
                }
                value = value.substring(0, posStart) + boundValue + value.substring(posEnd + 1);
                loopCount++;
            }
            // Set the new attribute value
            element.setAttribute(attr, value);
        }
    }
}

/**
 * Show an error in an element. This will style the element
 * with a red background and white text.
 *
 * @param {HTMLElement} element
 * @param {string} message
 */
export function showError(element, message)
{
    if (element === null) {
        showErrorAlert(message);
        return;
    }
    loadCss(errorStyleId, errorCss);
    const span = document.createElement('span');
    span.className = 'dataformsjs-error';
    span.textContent = message;
    element.innerHTML = '';
    element.appendChild(span);
    if (typeof message !== 'string') {
        console.error(message);
    }
}

/**
 * Show an error in an element. This will style the element
 * with a red background and white text. If called twice
 * the message will overwrite the previous message.
 *
 * Unlike error alerts in the standard framework the user
 * does not have the ability to close these alerts.
 *
 * @param {string} message
 */
export function showErrorAlert(message) {
    loadCss(errorStyleId, errorCss);
    let errorText = message;
    if (typeof errorText === 'string' && errorText.toLowerCase().indexOf('error') === -1) {
        errorText = 'Error: ' + errorText;
    }
    const div = document.createElement('div');
    div.className = 'dataformsjs-fatal-error';
    div.textContent = errorText;
    const closeButton = document.createElement('span');
    closeButton.textContent = '✕';
    closeButton.onclick = (e) => {
        document.body.removeChild(e.target.parentNode);
    };
    div.insertBefore(closeButton, div.firstChild);
    document.body.appendChild(div);
    if (typeof message !== 'string') {
        console.error(message);
    }
}

/**
 * Append CSS to a Style Sheet in the Document if it does not yet exist.
 *
 * @param {string} id
 * @param {string} css
 */
export function loadCss(id, css) {
    let style = document.getElementById(id);
    if (style === null) {
        style = document.createElement('style');
        style.id = id;
        style.innerHTML = css;
        document.head.appendChild(style);
    }
}

/**
 * Return `true` if [polyfill.js] is being used. This allows Web Components to check
 * if the should run or not. Old Versions of Safari (10.#) have a bug where both
 * <script type="module"> and <script nomodule> will be loaded. Additionally the
 * issue can affect legacy Edge browsers as well.
 *
 * If this happens then allow the app to use the [polyfill.js] file since it runs first.
 *
 * Related Links:
 *   https://caniuse.com/es6-module
 *   https://gist.github.com/jakub-g/5fc11af85a061ca29cc84892f1059fec
 *   https://jakearchibald.com/2017/es-modules-in-browsers/
 *   https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc
 */
export function usingWebComponentsPolyfill() {
    return (window.app && window.app.settings && window.app.settings.usingWebComponentsPolyfill === true);
}

/**
 * As of late 2020 Safari and various mobile browsers do not support extending
 * standard elements using custom elements with [is="custom-element"].
 *
 * This function is used to call the polyfill setup code. Custom elements that
 * use the [is] attribute should call need to define a object in [window._webComponentPolyfills]
 * in order to use this. See examples from [sortable-table.js] and [input-filter.js].
 * 
 * https://caniuse.com/custom-elementsv1
 * 
 * @param {undefined|HTMLElement} rootElement
 */
export function polyfillCustomElements(rootElement = document) {
    // Check if the polyfill is needed. Example result:
    //   Chrome: false
    //   Safari: true
    if (polyfillIsNeeded === null) {
        class WebComponentCheck extends HTMLDivElement {}
        if (window.customElements.get('web-component-polyfill-check') === undefined) {
            // Only define the custom element once, if a page attempts to load
            // both 'utils.min.js' and 'utils.js' versions then an error can show
            // in console if the element is not first checked.
            window.customElements.define('web-component-polyfill-check', WebComponentCheck, { extends: 'div' });
        }
        let docEl = document.querySelector('body');
        if (!docEl) {
            docEl = document.documentElement;
        }
        docEl.insertAdjacentHTML('beforeend', '<div is="web-component-polyfill-check"></div>');
        const div = document.querySelector('div[is="web-component-polyfill-check"]');
        polyfillIsNeeded = !(div instanceof WebComponentCheck);
        docEl.removeChild(div);
    }

    // Update all elements on screen that need the polyfill
    if (polyfillIsNeeded && Array.isArray(window._webComponentPolyfills)) {
        for (const polyfill of window._webComponentPolyfills) {
            const elements = rootElement.querySelectorAll(`${polyfill.extendsElement}[is="${polyfill.element}"]`);
            for (const element of elements) {
                try {
                    polyfill.setup(element);
                } catch (e) {
                    showErrorAlert(e);
                    console.log(polyfill.element);
                    console.log(element);
                }
            }
        }
    }
}

/**
 * For Safari, Samsung Internet, and Legacy Edge.
 * See comments in `polyfillCustomElements()`.
 *
 * @param {string} element
 * @param {string} extendsElement
 * @param {function} setup
 */
export function defineExtendsPolyfill(element, extendsElement, setup) {
    window._webComponentPolyfills = window._webComponentPolyfills || [];
    window._webComponentPolyfills.push({ element, extendsElement, setup });
    document.addEventListener('DOMContentLoaded', runPolyfill);
}

/**
 * Internal function that gets called from `defineExtendsPolyfill()`. Because this
 * is a named function it gets called only once if added to 'DOMContentLoaded'
 * multiple times. In SPA sites that use <url-router> or pages that use <json-data>
 * the needed function `polyfillCustomElements()` will get called, however if components
 * such as <input is="input-filter"> are loaded on a plan page with no routing or data
 * component they would never otherwise. This functions runs for those cases.
 */
function runPolyfill() {
    polyfillCustomElements(document);
}

/**
 * Return a promise that can be used to check if custom web components are
 * defined. The promise will resolve once all document components are defined.
 * When components are first added to DOM they are not yet defined until
 * the browser finishes creating this classes, this happens very quickly
 * however if code that depends on the components runs before they are
 * setup then unexpected errors occur.
 *
 * See also [componentsAreSetup()].
 *
 * @param {HTMLElement} element
 * @param {string} selector
 * @return {Promise}
 */
export function componentsAreDefined(element, selector = '') {
    return new Promise(async (resolve) => {
        const undefinedComponents = element.querySelectorAll(selector + ':not(:defined)');
        if (undefinedComponents.length > 0) {
            const promises = [...undefinedComponents].map(
                c => window.customElements.whenDefined(c.getAttribute('is') || c.localName)
            );
            await Promise.all(promises);
        }
        resolve();
    });
}

/**
 * Return a promise that can be used to check if custom web components are setup and ready.
 * The promise will resolve once all web components are defined and no elements
 * have the [not-setup] attribute. The [not-setup] is intended for custom web components
 * that need additional setup after they have been added to the DOM.
 *
 * See also [componentsAreDefined()] and [isAttachedToDom()]
 *
 * @return {Promise}
 */
export function componentsAreSetup() {
    return new Promise(async (resolve) => {
        // Wait until all web components on the page are defined.
        const undefinedComponents = document.querySelectorAll(':not(:defined)');
        if (undefinedComponents.length > 0) {
            const promises = [...undefinedComponents].map(
                c => window.customElements.whenDefined(c.getAttribute('is') || c.localName)
            );
            await Promise.all(promises);
        }

        // Check every 1/100th of a second for elements with the [not-setup]
        // attribute. For example usage of this, see web components [data-table.js]
        // which sets up [not-setup] and [input-filter.js] which calls this function.
        // This will run for a max of 10 seconds to avoid issue with very slow
        // page slows, search screens that wait for setup after a user action, etc.
        const maxLoops = 1000;
        let loopCount = 0;
        const interval = window.setInterval(() => {
            const notSetup = document.querySelectorAll('[not-setup]');
            if (notSetup.length === 0) {
                window.clearInterval(interval);
                resolve();
            } else if (loopCount > maxLoops) {
                window.clearInterval(interval);
                resolve();
            }
            loopCount++;
        }, 10);
    });
}

/**
 * Return `true` if an element is attached to the DOM. This function
 * can be used with [componentsAreSetup()] as a safety check before
 * running code in case custom elements do not remove the [not-setup]
 * attribute.
 *
 * @param {HTMLElement} element
 */
export function isAttachedToDom(element) {
    let node = element.parentNode;
    while (node !== null) {
        node = node.parentNode;
        if (node === document) {
            return true;
        }
    }
    return false;
}
