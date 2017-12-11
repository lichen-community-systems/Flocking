# Distortion Unit Generators #

Flocking includes a collection of distortion algorithms:

 * `flock.ugen.distortion`, a simple waveshaper distortion
 * `flock.ugen.distortion.deJong`, a waveshaper distortion by Bram de Jong
 * `flock.ugen.distortion.tarrabiaDeJong`, a waveshaper distortion by Partice Tarrabia and Bram de Jong
 * `flock.ugen.distortion.gloubiBoulga`, waveshaper distortion by Laurent de Sora
 * `flock.ugen.distortion.tanh`, tanh-based distortion

All distortions support the following rates:

`demand`, `scheduled`, `control`, `constant`

## flock.ugen.distortion ##

A simple [waveshaper-based distortion effect](http://www.musicdsp.org/showone.php?id=114) by Jon Watte, which uses the polynomial y = (3/2) * x - (1/2) * x^3.

### Inputs ###

#### gain ####
<table>
    <tr>
        <th>description</th>
        <td>the gain factor to apply [1.0..Infinity]</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`1`..`Infity`</td>
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

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>the source signal to distort</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`null`</td>
    </tr>
</table>


## flock.ugen.distortion.deJong ##

A [waveshaper-based distortion effect by Bram de Jong](http://www.musicdsp.org/showone.php?id=41).

"If amount is 1, it results in a slight distortion and with bigger values the signal gets more funky. A good thing about the shaper is that feeding it with bigger-than-one amounts, doesn't create strange fx. The maximum this function will reach is 1.2 for for amount=1."

### Inputs ###

#### amount ####
<table>
    <tr>
        <th>description</th>
        <td>a value between 1 and Infinity that represents the amount of distortion to apply</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`1`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`2.0` (constant)</td>
    </tr>
</table>

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>the source signal to distort</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`null`</td>
    </tr>
</table>

## flock.ugen.distortion.tarrabiaDeJong ##

A [waveshaper-based distortion effect by Partice Tarrabia and Bram de Jong](http://www.musicdsp.org/showone.php?id=46).

### Inputs ###

#### amount ####
<table>
    <tr>
        <th>description</th>
        <td>a value between 1 and -1 that represents the amount of distortion to apply</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`-1`..`1`</td>
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

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>the source signal to distort</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`null`</td>
    </tr>
</table>

## flock.ugen.distortion.gloubiBoulga ##

A more processor-intensive [waveshaper distortion by Laurent de Soras](http://www.musicdsp.org/showone.php?id=86).

### Inputs ###

#### gain ####
<table>
    <tr>
        <th>description</th>
        <td>a value between 1 and Infinity that represents the amount of distortion to apply</td>
    </tr>
    <tr>
        <th>range</th>
        <td>`1`..`Infinity`</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`1` (constant)</td>
    </tr>
</table>

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>the source signal to distort</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`null`</td>
    </tr>
</table>

## flock.ugen.distortion.tanh ##

### Inputs ###

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>the source signal to distort</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>`null`</td>
    </tr>
</table>
