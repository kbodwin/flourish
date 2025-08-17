# `flourish`

![](flourish_hex.svg)

`flourish` is a Quarto extension for styling code in rendered code chunks.

[Slides from useR!2025](https://www.visruth.com/flourish-talk#/title-slide)

## Installation

Install by running in your terminal:

```bash
quarto add kbodwin/flourish
```

and add this `yaml` in your qmd:

```yaml
filters:
 - flourish
```

## Current abilities of the package

* Apply default yellow highlighting by specifying a target

```yaml
#| flourish:
#| - target: "mean"
```

* Specify targets via regular expressions

```yaml
#| flourish:
#| - target-rx: "[0-9]*"
```

* Provide custom styling

```yaml
#| flourish:
#| - target:
#|      - "mean"
#|      - style:
#|            - "background-color: #FFC0CB;"
```

* Use `mask: true` to remove the original text of the target

```yaml
#| flourish:
#| - target:
#|     - "mean"
#|     - mask: true
#|     - style: "text-decoration: underline;"
```

See [example.qmd](/example.qmd) and its [rendered counterpart](/example.html) for further details.

## Future aspirations

* Allow for additional style attributes, e.g.

```yaml
#| flourish:
#| - target:
#|     - "mean"
#|     - style: 
#|         - "color: transparent;"
#|         - hover:
#|             - "color: black;"
```

* Provide many shortcut styles, e.g. "mask-underline" as a shortcut.

* Allow for only targeting the first match (or first two matches, or second match, etc. etc.)

* Allow for more specificity by line, such as highlighting a full line, or only targeting matches in a particular range.

* Allow global YAML to flourish the whole document at once.

* Allow user to specify the class wrapper for targets, so they can also write their own custom class CSS directly.

* Add option to apply flourish to the code output as well. (This is fairly low-hanging fruit for text output but unlikely to work with complex output.)

* Maybe: Use similar syntax to flourish plaintext in a Quarto doc, e.g.

```
::: flourish
- target: mean

Let's flourish this text, that's what I mean.
:::
```

### Bugs to fix

* Right now, I believe it's not sanitized against rx special characters; e.g. if you want to flourish the literal character "*" that will not work.

* In HTML, some special characters appear different, e.g. `<` appears as `&lt;`. That means that choosing `x <- 1:10` as a flourish target won't work, because the `<` won't get matched.

### Things you might want but we don't plan to do

* Functionality for pdf or docx.  This extension is written in JavaScript for HTML; any other doc formats would require a total rebuild from the ground up.

* Flourishing non-text output. For example, it would be tough to use code chunk YAML to automatically flourish words in a ggplot title.
