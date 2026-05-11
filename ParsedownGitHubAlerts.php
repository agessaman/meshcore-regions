<?php

/**
 * Parsedown extension: GitHub-style markdown alerts
 * (blockquotes that begin with > [!NOTE], > [!TIP], etc.)
 *
 * @see https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts
 */
class ParsedownGitHubAlerts extends Parsedown
{
    public function __construct()
    {
        array_unshift($this->BlockTypes['>'], 'Alert');
    }

    protected function blockAlert($Line)
    {
        if (!preg_match('/^>[ ]?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ ]?(.*)$/i', $Line['text'], $m)) {
            return;
        }

        $kind = strtoupper($m[1]);
        $lines = array();
        if ($m[2] !== '') {
            $lines[] = $m[2];
        }

        return array(
            'alertKind' => $kind,
            'alertLines' => $lines,
        );
    }

    protected function blockAlertContinue($Line, array $Block)
    {
        if (!isset($Block['alertKind'])) {
            return;
        }

        if ($Line['text'][0] === '>' && preg_match('/^>[ ]?(.*)/', $Line['text'], $matches)) {
            if (isset($Block['interrupted'])) {
                $Block['alertLines'][] = '';
                unset($Block['interrupted']);
            }

            $Block['alertLines'][] = $matches[1];

            return $Block;
        }

        if (!isset($Block['interrupted'])) {
            $Block['alertLines'][] = $Line['text'];

            return $Block;
        }
    }

    protected function blockAlertComplete(array $Block)
    {
        $kind = $Block['alertKind'];
        $slug = strtolower($kind);
        $lines = $Block['alertLines'];

        $children = array(
            array(
                'name' => 'p',
                'attributes' => array('class' => 'gh-alert-title'),
                'text' => $this->githubAlertTitle($kind),
            ),
        );

        if ($lines !== array()) {
            $children[] = array(
                'name' => 'div',
                'attributes' => array('class' => 'gh-alert-body'),
                'handler' => 'lines',
                'text' => $lines,
            );
        }

        $Block['element'] = array(
            'name' => 'aside',
            'attributes' => array(
                'class' => 'gh-alert gh-alert-' . $slug,
                'data-alert' => $slug,
            ),
            'handler' => 'elements',
            'text' => $children,
        );

        unset($Block['alertKind'], $Block['alertLines']);

        return $Block;
    }

    protected function githubAlertTitle($kind)
    {
        static $titles = array(
            'NOTE' => 'Note',
            'TIP' => 'Tip',
            'IMPORTANT' => 'Important',
            'WARNING' => 'Warning',
            'CAUTION' => 'Caution',
        );

        return isset($titles[$kind]) ? $titles[$kind] : $kind;
    }
}
