# Mouse Unit Generators #

Flocking supports several unit generators that provide user input from the mouse as a "signal" or stream of samples directly within your synth. They include:

 * `flock.ugen.mouse.click`, a trigger that fires when the mouse is clicked
 * `flock.ugen.mouse.cursor`, which outputs the cursor's x or y axis position, normalized between 0.0-1.0

## Mouse Click ##

The `flock.ugen.mouse.click` unit generator is a gate that is opened whenever the user clicks the mouse button. Like all gates, _click_ will output a sample value of 1.0 when it is open. It will continue to output positive values while the mouse button is held down, and then will return to 0.0 when the button is released.

By default, the `click` unit generator is scoped to the whole page. If the user clicks anywhere within the browser window, the gate will open. Alternatively, you can bind a particular element to the unit generator. For example, a button. In this case, the gate will only open when that element or any of its children is clicked.

The `click` unit generator does not capture click events or prevent the element's default action.

The `flock.ugen.mouse.click` unit generator can run at the following rates:
`control`, `audio`

### Inputs ###
 
#### mul ####
<table>
    <tr>
        <th>description</th>
        <td>a multiplier that scales the value of the click</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`-Infinity`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`1.0` (constant)</td>
    </tr>
</table>

#### add ####
<table>
    <tr>
        <th>description</th>
        <td>a value added to the value of the click</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`-Infinity`..`Infinity`</td>
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

#### target ####
<table>
    <tr>
        <th>description</th>
        <td>the DOM element on which to listen for clicks</td>
    </tr>
    <tr>
        <th>range</th>
        <td>any querySelector-compatible selector or a raw DOM element</td>
    </tr>
    <tr>
        <th>default</th>
        <td>window</td>
    </tr>
</table>

## Mouse Cursor ##

The `flock.ugen.mouse.cursor` unit generator is a signal that represents the mouse's current position within some coordinate system. By default, it is configured to report the position of the cursor within the browser window, but it can be scoped to individual elements.

The `cursor` unit generator outputs values between 0.0 and 1.0. When the cursor is at the farthest left point of the unit generator's target, the value will be 0.0. At the farthest right point, it will be 1.0. This value can be scaled using the `mul` and `add` inputs. Since mouse events don't fire at audio rate, causing cause audible stair stepping or "zippering" to occur, this unit generator also offers a `lag` input that specifies the lag time for a built-in low-pass lag filter that is capable of smoothing the output.

The `flock.ugen.mouse.cursor` unit generator can run at the following rates:

    control, audio

### Inputs ###

#### mul ####
<table>
    <tr>
        <th>description</th>
        <td>a multiplier that scales the value of the cursor position</td>
    </tr>
    <tr>
        <th>range</th>
        <td>-Infinity..Infinity</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>constant, control</td>
    </tr>
    <tr>
        <th>default</th>
        <td>1.0 (constant)</td>
    </tr>
</table>

#### add ####
<table>
    <tr>
        <th>description</th>
        <td>a value added to the cursor position value</td>
    </tr>
    <tr>
        <th>range</th>
        <td>-Infinity..Infinity</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>constant, control</td>
    </tr>
    <tr>
        <th>default</th>
        <td>0.0 (constant)</td>
    </tr>
</table>

#### lag ####
<table>
    <tr>
        <th>description</th>
        <td>a lag factor, in seconds. This is used to dezipper the output</td>
    </tr>
    <tr>
        <th>range</th>
        <td>-Infinity..Infinity</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>constant, control</td>
    </tr>
    <tr>
        <th>default</th>
        <td>0.5 (constant)</td>
    </tr>
</table>

### Options ###

#### axis ####
<table>
    <tr>
        <th>description</th>
        <td>the axis to track (x or y)</td>
    </tr>
    <tr>
        <th>enumeration</th>
        <td>"x"/"width" or "y"/"horizontal"</td>
    </tr>
    <tr>
        <th>default</th>
        <td>"x"</td>
    </tr>
</table>

#### target ####
<table>
    <tr>
        <th>description</th>
        <td>the DOM element in which to track cursor movement</td>
    </tr>
    <tr>
        <th>range</th>
        <td>any querySelector-compatible selector or a raw DOM element</td>
    </tr>
    <tr>
        <th>default</th>
        <td>window</td>
    </tr>
</table>