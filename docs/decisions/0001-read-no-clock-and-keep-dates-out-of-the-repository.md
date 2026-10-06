# 1. Read no clock, and keep dates out of the repository

## Status

Accepted

## Context

A payout batch is full of things a tool could compare with the calendar: the date a batch is to be executed, the date an
IBAN format came into force in the registry, the date a currency code was added to ISO 4217 or withdrawn from it, the
date a list was published. It is tempting to let the calendar in: a report stamped with the time of the run, a warning
on a batch whose execution date has passed, a note on when the registry was last changed. Each of these would make the
same file give a different output on a different day, so the saved output of the examples could never be compared with
a new run, and two people reading the same commit could see two reports.

The checks do not need a date. Whether an IBAN passes its check digits and has the length of its country, whether a
currency is in the list and how many decimals it has, and whether the totals match the rows can all be read from the
file and the saved tables. The public pages and lists the checks rest on are named by addresses that hold no year.

## Decision

1. The tool reads no clock, no time zone and no locale. It never prints the current time and never says when a page, a
   list or a release was published. A batch carries no execution date the tool reads. The same file gives the same
   output on every machine and on every day.
2. No document, example or test of this repository holds a date or a number that reads like a year: not the licence,
   not the changelog, not the documents, not the comments of the code, not the examples. `npm run check` and a test fail
   on any word of four digits that starts with 19 or 20. The saved copies of the public pages under research/sources are
   the pages' own words and are the one place the check does not read for prose; even so, the lines that carry a date or
   a number that reads like a year (the effective date of an IBAN format, the date list one was published, the dates of
   a communique and its amendments, the date of a log line, the date a page was last changed) were left out of the
   copies, so the test that reads every file for a year passes over them too. research/sources.md lists every line that
   was left out.
3. A version, an amount, an account number or the number of a standard is not a year and is not caught: 1.0.0, Node 22,
   an amount of 150000, ISO 4217, ISO 13616, SARIF 2.1.0 and NIST SP 800-218 hold no year. An IBAN is one word of
   letters and digits and never holds a year as a word of its own, and the examples avoid printed IBANs whose groups of
   four would. A test of test/repo.test.js runs the pattern over such values and checks that none of them is caught, and
   that a year in the same place still is.
4. The sources are chosen with addresses that hold no year, and the notes on them name no publication date.

## Consequences

- The output of a run can be saved in the repository (`examples/output`) and compared on every change, because it does
  not move with the calendar.
- The report holds no date and no deadline; an IBAN format that is to change, or a currency that is to be replaced, is
  for the team to find in the registry and the list themselves, and comes into the tool with a release.
- The examples use amounts, ids and rates that do not read like a year, and a check catches one that does.
