export const frontendExplanations = {
  "react-missing-key": {
    whatHappened: "Items in a list are created without a key. React uses keys to track items, so without them it can reuse or lose the wrong elements when the list changes.",
    proposedChange: "Add a key prop with a value that is unique and stable for each item, such as an id from your data. Avoid using the array index when items can be added, removed, or reordered.",
  },
  "react-dangerous-html": {
    whatHappened: "dangerouslySetInnerHTML inserts raw HTML into the page. If that HTML comes from users or an API, it can contain scripts that run in other people's browsers.",
    proposedChange: "Render the content with normal JSX where possible. If raw HTML is required, sanitize it first with a trusted library such as DOMPurify.",
  },
  "a11y-img-alt": {
    whatHappened: "An image without alt text is silent for people using screen readers, and it shows nothing if the image fails to load.",
    proposedChange: "Add alt text that describes what the image shows or means. For decorative images, use alt=\"\" so screen readers skip them.",
  },
  "a11y-input-label": {
    whatHappened: "A form input without a label is hard to use with a screen reader, because the user can't tell what to type.",
    proposedChange: "Connect the input to a label element with a matching htmlFor and id, or add an aria-label that describes the field.",
  },
  "a11y-click-div": {
    whatHappened: "A clickable div or span can be clicked with a mouse, but it can't be reached with a keyboard and screen readers don't announce it as a button.",
    proposedChange: "Use a button element for actions and an a element for links. If you must use a div, add role, tabIndex, and a key handler for Enter and Space.",
  },
};