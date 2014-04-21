# Triggers and Triggerables #

Triggerable unit generators are unit generators that perform a particular action when they receive a trigger signal. A trigger occurs whenever a signal changes from non-positive to positive. For example, `flock.ugen.playBuffer` will play back an audio buffer whenever it receives a trigger value.

Triggers are unit generators that emit periodic positive values, which can be used to trigger actions in other unit generators such as envelopes and granulators. For example. `flock.ugen.impulse` will emit a single positive value at the specified frequency.

# Triggerables #

## flock.ugen.triggerCallback ##

`flock.ugen.triggerCallback` will cause a function to be invoked whenever its `trigger` input crosses from non-positive to positive. The value of this unit generator's `source` input will always be provided as the last argument to the callback. The callback is specified using a _callbackSpec_, which can contain any of the following properties:

<table>
    <tr>
        <th>func</th>
        <td>A raw function pointer to invoke</td>
    </tr>
    <tr>
        <th>funcName</th>
        <td>A key path specifying a global function to invoke</td>
    </tr>
    <tr>
        <th>"this"</th>
        <td>A key path pointing to an object instance (e.g. "jQuery"). Must be accompanied by a `method` property.</td>
    </tr>
    <tr>
        <th>method</th>
        <td>A string specifying the method to invoke (e.g. "ajax")</td>
    </tr>
    <tr>
        <th>args</th>
        <td>An array of arguments to pass to each callback. The `source` input's current value will always be passed as the last argument.</td>
    </tr>
</table>


For example, this synth will print out the current value of a sine wave oscillator to the console twice per second:

    {
        ugen: "flock.ugen.triggerCallback",
        source: {
            ugen: "flock.ugen.sin",
            freq: 440
        },
        trigger: {
            ugen: "flock.ugen.impulse",
            freq: 2
        },
        options: {
            callback: {
                "this": "console",
                method: "log",
                args: ["Sinewave value is"]
            }
        }
    }

This unit generator will always pass through its `source` input unchanged as its output. `flock.ugen.triggerCallback` supports the following rates:

`demand`, `scheduled`, `control`, `constant`


### Inputs ###

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>a source signal, which will be passed through as-is (and will be provided as the last argument to the callback).</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0` (constant)</td>
    </tr>
</table>

#### trigger ####
<table>
    <tr>
        <th>description</th>
        <td>a trigger signal, which will cause the callback to fire whenever it crosses from positive to non-positive</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`1.0`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0.0` (constant)</td>
    </tr>
</table>


### Options ###

#### callback ####
<table>
    <tr>
        <th>description</th>
        <td>a callback spec</td>
    </tr>
    <tr>
        <th>range</th>
        <td>Object</td>
    </tr>
</table>


# Triggers #

## flock.ugen.valueChangeTrigger ##

`flock.ugen.valueChangeTrigger` will fire (i.e. cross from non-positive to positive) whenever its `source` input changes value. For example, this synthDef will cause a trigger to fire whenever the mouse is clicked:

    {
        ugen: "flock.ugen.valueChangeTrigger",
        source: {
            ugen: "flock.ugen.mouse.click"
        }
    }

This supports the following rates:

`demand`, `scheduled`, `control`, `constant`

### Inputs ###

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>a source signal that will cause the trigger to fire whenever its value changes</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0` (constant)</td>
    </tr>
</table>

## flock.ugen.inputChangeTrigger ##

`flock.ugen.inputChangeTrigger` will fire (i.e. cross from non-positive to positive) whenever its `source` input is changed to a different unit generator. This will only occur if the user changes the unit generator graph by making a call to `set`.

This supports the following rates:

`demand`, `scheduled`, `control`, `constant`

### Inputs ###

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>a source signal that will cause the trigger to fire whenever it changes (with a call to `set`)</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`0`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`0` (constant)</td>
    </tr>
</table>
