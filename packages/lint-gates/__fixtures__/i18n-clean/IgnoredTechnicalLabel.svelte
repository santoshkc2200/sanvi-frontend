<!--
  Demonstrates the escape hatch: a non-translatable technical string
  (a version tag) that the heuristic would otherwise flag. The ignore
  comment goes immediately before the specific text/tag it suppresses —
  here that's the text node, so it sits right after the opening tag.
-->
<span class="version-tag"><!-- sanvi-i18n-ignore -->Build SHA abc1234</span>
