"""Builds spotbar.css from the template, expanding the selector prefixes."""
import os, re

HERE = os.path.dirname(os.path.abspath(__file__))
BOOST = ":not(#sb-x1):not(#sb-x2):not(#sb-x3)"  # raises priority above theme extensions
PREFIX = {
    "$P": "html[data-spotbar-active]" + BOOST,
    "$C": 'html[data-spotbar-active][data-spotbar-colors="on"]' + BOOST,
    "$T": 'html[data-spotbar-active][data-spotbar-truesize="on"]' + BOOST,
    "$H": "html" + BOOST,
}

src = open(os.path.join(HERE, "spotbar.template.css"), encoding="utf-8").read()
out = re.sub(r"\$[PCTH]", lambda m: PREFIX[m.group(0)], src)
# S(12px) -> a length that grows with the "true size" scale
out = re.sub(r"S\((-?[\d.]+)px\)", lambda m: f"calc({m.group(1)}px * var(--sb-s, 1))", out)
out = out.replace("Generated from src/spotbar.template.css by build.py.", "Generated from src/spotbar.template.css by src/build.py — edit that file instead.")
assert "$" not in out and "S(" not in out
open(os.path.join(HERE, "..", "spotbar.css"), "w", encoding="utf-8").write(out)
print("spotbar.css:", len(out), "bytes")
