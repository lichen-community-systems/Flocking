# Distortion UGENs #

Flocking includes a collection of distortion algorithms. 

 * `flock.ugen.distortion`, A simple waveshaper-based distortion effect.
 * `flock.ugen.distortion.deJonge`, A simple waveshaper-based distortion effect by Bram de Jonge
 * `flock.ugen.distortion.tarrabiaDeJonge`, A simple waveshaper-based distortion effect by Partice Tarrabia and Bram de Jong
 * `flock.ugen.distortion.gloubiBoulga`, Waveshaper distortion by Laurent de Sora
 * `flock.ugen.distortion.tanh`, A simple tanh distorition

All distortions support the following rates:

`demand`, `scheduled`, `control`, `constant`

## flock.ugen.distortion ##

A simple waveshaper-based distortion effect.

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


## flock.ugen.distortion.deJonge ##

A simple waveshaper-based distortion effect by Bram de Jonge.

### Inputs ###

#### amount ####
<table>
    <tr>
        <th>description</th>
        <td>a value between 1 and Infinity that represents the amount of distortion to apply</td>
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
        <td>`2.0` (constant)</td>
    </tr>
</table>

## flock.ugen.distortion.tarrabiaDeJonge ##

A simple waveshaper-based distortion effect by Partice Tarrabia and Bram de Jong.

http://www.musicdsp.org/showone.php?id=46

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
        <td>`10` (constant)</td>
    </tr>
</table>

## flock.ugen.distortion.gloubiBoulga ##

Waveshaper distortion by Laurent de Soras

http://www.musicdsp.org/showone.php?id=86

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

## flock.ugen.distortion.tanh ##

### Inputs ###

#### source ####
<table>
    <tr>
        <th>description</th>
        <td>source ugen</td>
    </tr>
    <tr>
        <th>rates</th>
        <td>`constant`, `control`, `audio`</td>
    </tr>
    <tr>
        <th>default</th>
        <td>empty</td>
    </tr>
</table>
