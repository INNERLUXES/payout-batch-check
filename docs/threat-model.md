# Threat model

The tool is an input to a review before the batch is sent: not a compliance or sanctions screening and not a guarantee
that a payment will arrive. This document is about the tool itself: what it touches, what a hostile or careless batch
file can try, and what stops it.

## What the tool touches

- It reads the one file named on the command line. Nothing else is opened, and no IBAN, BIC, wallet address, URL or path
  written in the batch is looked up or followed.
- It writes the report to standard output and its errors to standard error. It writes nothing to disk.
- It opens no network connection, fetches no URL, contacts no bank, chain, provider or API, follows no symbolic link,
  runs nothing it reads, evaluates nothing and reads no clock and no locale.

## What the input may hold

A payout batch comes from a system that exports it, a person who edits it, or an upload, and in a pipeline that checks
every pull request it may be written by whoever opened the pull request. Through it, a person can try to, or a careless
change can:

- put a private key, a seed or a mnemonic in the file, as a column or a field next to a wallet address, so that the tool
  copies it into a pipeline log, a pull request comment or a code scanning upload;
- make the tool read outside the file: a link named on the command line, a folder, an address given as the path;
- make the tool reach a bank, a chain or a server: an IBAN, a BIC or a wallet address written in the batch;
- exhaust the memory, the stack or the time: a file of many megabytes, a hundred thousand payments compared with each
  other, arrays and objects nested very deep, very long fields, numbers with thousands of digits, a quoted CSV field that
  is never closed;
- move the result: a key written twice so that two readers see two values, a CSV column named twice, a misspelt key that
  hides an amount, a field of the wrong type that might be taken as fine, a row with a field too many that shifts every
  value after it, amounts that a floating point number would add up wrongly so that a total seems to match;
- slip in something that is not text: a binary file named `.csv`, bytes that are not valid UTF-8 or UTF-16;
- rewrite the terminal or break the output: control characters, escape sequences, direction controls and line separators
  in a beneficiary name, a payment id or a wallet address;
- hide markup in the markdown report: a link, a table separator or a tag in a name;
- change how objects behave: a key, a column or a total named `__proto__`, `constructor` or `toString`.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| A secret in the file is copied into the output | Before the batch is read, every key, column and value is looked at for a key or a seed; each one found is a `secret-in-batch` error, the value is marked, the reader leaves it out as if it were not there, and no message names it. Tests put each shape under several fields and in a CSV column, and check every format for the value |
| A link makes the tool read a file it was not given | The path is checked with `lstat` and a link is refused by name; the file is opened with `O_NOFOLLOW` where the system has it, and its type and size are taken from the open handle. A test puts a link in the folder |
| The tool reaches a bank, a chain or a server, fetches, connects or runs something | No module of the network or of child processes is imported, nothing is evaluated, an IBAN, a BIC and a wallet address are only text that is checked for its form, and a path that looks like an address is refused. A test checks the imports of src |
| The memory, the stack or the time is exhausted | The file has a size limit checked on the open handle before it is read; the readers keep limits of rows, columns, fields, nesting, values and string length, the JSON reader and the search for secrets keep stacks of their own, and the CSV reader is one loop; payments have a limit of 100,000 and are compared with maps, not with each other in pairs. Tests check the time, with limits that widen under coverage only |
| A key written twice or a column named twice hides a value | A key written twice in one JSON object is a `batch-unreadable` finding; a column named twice is a `field-duplicate` finding and the second is left out |
| A row with a field too many or too few shifts the values | A CSV row with another number of fields than the header stops the reader with its line, and so do a quote in the wrong place and a quoted field that is never closed |
| A misspelt or missing field passes for one that is fine | A key the tool does not read is a `field-unknown` finding with the key it is probably meant to be; a missing field is `field-missing`; a value of the wrong type is `field-invalid`; each with its line |
| Amounts add up wrongly | Amounts, totals and rates are read from the characters of the file into a whole number and a scale and added and compared with BigInt; an exponent or a separator is refused |
| A binary file or bytes in another encoding are read as text | A null byte in UTF-8, an odd number of bytes in UTF-16 and bytes that are not valid make the file an input error with exit code `2` and no report |
| Text from the file rewrites the terminal | Every text from the input goes through `safeText`, which replaces control, line separator and direction characters and caps the length. A test puts escapes and direction controls in a batch id, a payment id and a name, in every format |
| Markup in a name changes the markdown report | The markdown report escapes the characters markdown gives a meaning to. A test writes a link into a beneficiary name |
| `__proto__` changes how objects behave | Objects of a file and columns of a header are lists of entries compared with the names the tool reads, and no object is built with a key from a file; totals are kept in a list. A test uses `__proto__`, `constructor` and `hasOwnProperty` as keys, columns and totals |
| A device or a pipe hangs the tool | A path that is not a regular file is refused before it is read |
| The tool leaves files behind | Nothing is written to disk; there is no cache, no temporary file and no log. A test checks that a run leaves the folder as it was |

## Out of scope

Whether an account, a BIC or a wallet exists or belongs to the beneficiary, sanctions and fraud, the rate and the fees,
payments of earlier batches, the forms and secrets docs/limits.md says the tool does not see, who may change or upload
the batch, and where your pipeline keeps the output.
